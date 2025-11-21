/**
 * Text Sanitizer for TTS
 *
 * Prepares answer text for speech synthesis by removing markdown formatting,
 * URLs, code blocks, and special characters that don't read well.
 *
 * Feature 010: Text-to-Speech Responses
 */

/**
 * Sanitize text for TTS
 *
 * @param {string} text - Raw answer text (may contain markdown)
 * @param {Object} options - Sanitization options
 * @param {number} options.maxWords - Maximum words to include (default: 500)
 * @returns {string} Sanitized text ready for TTS
 */
export function sanitizeTextForTTS(text, options = {}) {
  const { maxWords = 500 } = options;

  if (!text || typeof text !== 'string') {
    return '';
  }

  let sanitized = text;

  // Remove code blocks (```...```)
  sanitized = sanitized.replace(/```[\s\S]*?```/g, ' code block ');

  // Remove inline code (`...`)
  sanitized = sanitized.replace(/`([^`]+)`/g, '$1');

  // Remove URLs and replace with "link"
  sanitized = sanitized.replace(
    /https?:\/\/[^\s]+/g,
    'link'
  );

  // Remove markdown headers (# ## ###)
  sanitized = sanitized.replace(/^#{1,6}\s+/gm, '');

  // Remove markdown bold/italic (**text** or *text*)
  sanitized = sanitized.replace(/\*\*([^*]+)\*\*/g, '$1');
  sanitized = sanitized.replace(/\*([^*]+)\*/g, '$1');

  // Remove markdown links [text](url)
  sanitized = sanitized.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove markdown lists (- or * or 1.)
  sanitized = sanitized.replace(/^[\s]*[-*]\s+/gm, '');
  sanitized = sanitized.replace(/^[\s]*\d+\.\s+/gm, '');

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]+>/g, '');

  // Replace special characters with readable equivalents
  sanitized = sanitized.replace(/&amp;/g, 'and');
  sanitized = sanitized.replace(/&lt;/g, 'less than');
  sanitized = sanitized.replace(/&gt;/g, 'greater than');
  sanitized = sanitized.replace(/&quot;/g, '"');
  sanitized = sanitized.replace(/&#39;/g, "'");

  // Normalize whitespace (remove extra spaces, newlines)
  sanitized = sanitized.replace(/\s+/g, ' ');
  sanitized = sanitized.trim();

  // Handle ellipsis
  sanitized = sanitized.replace(/\.{3,}/g, '...');

  // Truncate to max words if needed
  if (maxWords > 0) {
    const words = sanitized.split(/\s+/);
    if (words.length > maxWords) {
      sanitized = words.slice(0, maxWords).join(' ');
      // Add ellipsis if truncated
      if (!sanitized.endsWith('.') && !sanitized.endsWith('!') && !sanitized.endsWith('?')) {
        sanitized += '...';
      }
    }
  }

  return sanitized;
}

/**
 * Count words in text
 *
 * @param {string} text - Text to count
 * @returns {number} Word count
 */
export function countWords(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Check if text is too long for TTS
 *
 * @param {string} text - Text to check
 * @param {number} maxWords - Maximum allowed words
 * @returns {boolean} True if text exceeds limit
 */
export function isTooLong(text, maxWords = 500) {
  return countWords(text) > maxWords;
}

/**
 * Truncate text to word limit
 *
 * @param {string} text - Text to truncate
 * @param {number} maxWords - Maximum words
 * @returns {string} Truncated text
 */
export function truncateToWords(text, maxWords = 500) {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) {
    return text;
  }

  const truncated = words.slice(0, maxWords).join(' ');
  return truncated + '...';
}
