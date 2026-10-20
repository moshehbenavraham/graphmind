/**
 * PCM Audio Processor (AudioWorklet)
 *
 * Modern Web Audio API processor that replaces the deprecated ScriptProcessor.
 * Runs in a separate audio thread for better performance and lower latency.
 *
 * Features:
 * - Float32 to Int16 PCM conversion
 * - Configurable buffer aggregation
 * - Message-based communication with main thread
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    // Configuration from main thread
    const processorOptions = options.processorOptions || {};
    this.targetBufferSize = processorOptions.bufferSize || 4096;
    this.channelCount = processorOptions.channelCount || 1;

    // Internal state
    this.buffer = new Float32Array(this.targetBufferSize);
    this.bufferIndex = 0;
    this.sequence = 0;
    this.isActive = true;

    // Handle messages from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'stop') {
        this.isActive = false;
        // Flush remaining buffer if any
        if (this.bufferIndex > 0) {
          this.flushBuffer();
        }
      } else if (event.data.type === 'start') {
        this.isActive = true;
        this.bufferIndex = 0;
        this.sequence = 0;
      }
    };
  }

  /**
   * Convert Float32 audio samples to Int16 PCM
   * @param {Float32Array} float32Array - Input audio samples (-1.0 to 1.0)
   * @returns {Int16Array} - PCM encoded samples
   */
  float32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp value between -1 and 1
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      // Convert to 16-bit signed integer
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }

  /**
   * Flush accumulated buffer to main thread
   */
  flushBuffer() {
    if (this.bufferIndex === 0) return;

    // Create a copy of the filled portion
    const audioData = this.buffer.slice(0, this.bufferIndex);
    const pcmData = this.float32ToInt16(audioData);

    // Send to main thread
    this.port.postMessage({
      type: 'audio_chunk',
      pcmData: pcmData.buffer,
      sequence: this.sequence++,
      timestamp: currentTime * 1000, // Convert to milliseconds
      sampleCount: this.bufferIndex,
    }, [pcmData.buffer]); // Transfer ownership for zero-copy

    // Reset buffer
    this.bufferIndex = 0;
  }

  /**
   * Process audio frames
   * Called by the audio thread at regular intervals (typically 128 frames)
   *
   * @param {Float32Array[][]} inputs - Input audio data
   * @param {Float32Array[][]} outputs - Output audio data (unused for recording)
   * @param {Object} parameters - Audio parameters
   * @returns {boolean} - True to keep processor alive
   */
  process(inputs, _outputs, _parameters) {
    if (!this.isActive) {
      return true; // Keep alive but don't process
    }

    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    // Get first channel (mono)
    const channelData = input[0];
    if (!channelData || channelData.length === 0) {
      return true;
    }

    // Aggregate samples into buffer
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];

      // Flush when buffer is full
      if (this.bufferIndex >= this.targetBufferSize) {
        this.flushBuffer();
      }
    }

    return true; // Keep processor alive
  }
}

// Register the processor
registerProcessor('pcm-processor', PCMProcessor);
