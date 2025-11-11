/**
 * Audio utility functions for voice recording
 */

/**
 * Convert Blob to base64 string
 *
 * @param {Blob} blob - Audio blob
 * @returns {Promise<string>} Base64-encoded string
 */
export const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };

    reader.onerror = (error) => {
      reject(new Error(`Failed to convert blob to base64: ${error.message}`));
    };

    reader.readAsDataURL(blob);
  });
};

/**
 * Request microphone access with specific constraints
 *
 * @param {Object} constraints - Audio constraints
 * @returns {Promise<MediaStream>} Media stream
 */
export const requestMicrophoneAccess = async (constraints = {}) => {
  const defaultConstraints = {
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...constraints,
    },
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(defaultConstraints);
    return stream;
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      throw new Error('Microphone access denied. Please enable microphone permissions in your browser.');
    } else if (error.name === 'NotFoundError') {
      throw new Error('No microphone found. Please connect a microphone and try again.');
    } else if (error.name === 'NotReadableError') {
      throw new Error('Microphone is already in use by another application.');
    } else {
      throw new Error(`Failed to access microphone: ${error.message}`);
    }
  }
};

/**
 * Check if browser supports required audio features
 *
 * @returns {Object} Capabilities check result
 */
export const checkAudioCapabilities = () => {
  const capabilities = {
    mediaDevices: !!navigator.mediaDevices,
    getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    mediaRecorder: !!window.MediaRecorder,
    webSocket: !!window.WebSocket,
  };

  const allSupported = Object.values(capabilities).every((cap) => cap);

  return {
    ...capabilities,
    supported: allSupported,
    unsupportedFeatures: Object.keys(capabilities).filter((key) => !capabilities[key]),
  };
};

/**
 * Get supported MIME types for MediaRecorder
 *
 * @returns {Array<string>} Supported MIME types
 */
export const getSupportedMimeTypes = () => {
  const types = [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/wav',
  ];

  return types.filter((type) => {
    if (window.MediaRecorder && typeof MediaRecorder.isTypeSupported === 'function') {
      return MediaRecorder.isTypeSupported(type);
    }
    return false;
  });
};

/**
 * Get best available MIME type for recording
 *
 * @returns {string} MIME type
 */
export const getBestMimeType = () => {
  const supportedTypes = getSupportedMimeTypes();

  // Prefer webm with opus codec
  if (supportedTypes.includes('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }

  if (supportedTypes.includes('audio/webm')) {
    return 'audio/webm';
  }

  // Fallback to first available
  return supportedTypes[0] || 'audio/webm';
};

/**
 * Calculate audio duration from chunks
 *
 * @param {Array<Blob>} chunks - Audio chunks
 * @param {number} timeslice - Recording timeslice in ms
 * @returns {number} Estimated duration in seconds
 */
export const estimateAudioDuration = (chunks, timeslice = 1500) => {
  return Math.ceil((chunks.length * timeslice) / 1000);
};

/**
 * Stop all tracks in a media stream
 *
 * @param {MediaStream} stream - Media stream
 */
export const stopMediaStream = (stream) => {
  if (stream) {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  }
};

/**
 * Validate audio chunk size
 *
 * @param {Blob} blob - Audio blob
 * @param {number} maxSize - Maximum size in bytes (default: 2MB)
 * @returns {boolean} Is valid
 */
export const validateAudioChunkSize = (blob, maxSize = 2 * 1024 * 1024) => {
  return blob.size <= maxSize;
};

/**
 * Create MediaRecorder with best settings
 *
 * @param {MediaStream} stream - Media stream
 * @param {Object} options - MediaRecorder options
 * @returns {MediaRecorder} MediaRecorder instance
 */
export const createMediaRecorder = (stream, options = {}) => {
  const mimeType = getBestMimeType();

  const recorderOptions = {
    mimeType,
    ...options,
  };

  try {
    return new MediaRecorder(stream, recorderOptions);
  } catch (error) {
    console.error('Failed to create MediaRecorder with options:', recorderOptions);
    // Fallback to default settings
    return new MediaRecorder(stream);
  }
};

/**
 * Format time as MM:SS
 *
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time
 */
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format timestamp for display
 *
 * @param {string|Date} timestamp - ISO timestamp or Date object
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted timestamp
 */
export const formatTimestamp = (timestamp, options = {}) => {
  if (!timestamp) return '';

  try {
    const date = new Date(timestamp);

    const defaultOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      ...options,
    };

    return date.toLocaleString('en-US', defaultOptions);
  } catch (err) {
    console.error('Failed to format timestamp:', err);
    return String(timestamp);
  }
};

export default {
  blobToBase64,
  requestMicrophoneAccess,
  checkAudioCapabilities,
  getSupportedMimeTypes,
  getBestMimeType,
  estimateAudioDuration,
  stopMediaStream,
  validateAudioChunkSize,
  createMediaRecorder,
  formatTime,
  formatTimestamp,
};
