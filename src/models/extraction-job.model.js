/**
 * Extraction Job Model Schema
 * Feature: 005-entity-extraction
 *
 * Defines the queue message format for entity extraction jobs.
 * Used for enqueueing and processing extraction jobs via Cloudflare Queues.
 */

/**
 * Job Status Values
 */
export const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * Create an extraction job message for queue
 *
 * @param {string} noteId - Voice note ID
 * @param {string} userId - User ID (for data isolation)
 * @param {string} transcript - Voice note transcript text
 * @returns {Object} Extraction job message
 */
export function createExtractionJob(noteId, userId, transcript) {
  if (!noteId || typeof noteId !== 'string') {
    throw new Error('noteId is required and must be a string');
  }
  if (!userId || typeof userId !== 'string') {
    throw new Error('userId is required and must be a string');
  }
  if (!transcript || typeof transcript !== 'string') {
    throw new Error('transcript is required and must be a string');
  }

  return {
    note_id: noteId,
    user_id: userId,
    transcript: transcript,
    enqueued_at: Date.now(),
    retry_count: 0,
  };
}

/**
 * Validate an extraction job message
 *
 * @param {Object} job - Extraction job message
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateExtractionJob(job) {
  const errors = [];

  // Required fields
  if (!job.note_id || typeof job.note_id !== 'string') {
    errors.push('Job must have a valid note_id (string)');
  }

  if (!job.user_id || typeof job.user_id !== 'string') {
    errors.push('Job must have a valid user_id (string)');
  }

  if (!job.transcript || typeof job.transcript !== 'string') {
    errors.push('Job must have a valid transcript (string)');
  } else if (job.transcript.trim().length === 0) {
    errors.push('Job transcript cannot be empty');
  }

  if (typeof job.enqueued_at !== 'number') {
    errors.push('Job must have a valid enqueued_at timestamp (number)');
  }

  if (typeof job.retry_count !== 'number' || job.retry_count < 0) {
    errors.push('Job retry_count must be a non-negative number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create job status object for KV tracking
 *
 * @param {string} noteId - Voice note ID
 * @param {string} status - Job status
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Job status object
 */
export function createJobStatus(noteId, status, metadata = {}) {
  if (!Object.values(JOB_STATUS).includes(status)) {
    throw new Error(`Invalid job status: ${status}`);
  }

  return {
    note_id: noteId,
    status,
    ...metadata,
    updated_at: Date.now(),
  };
}

/**
 * Increment retry count for failed job
 *
 * @param {Object} job - Extraction job message
 * @returns {Object} Updated job with incremented retry count
 */
export function incrementRetryCount(job) {
  return {
    ...job,
    retry_count: (job.retry_count || 0) + 1,
  };
}

/**
 * Check if job has exceeded max retries
 *
 * @param {Object} job - Extraction job message
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @returns {boolean}
 */
export function hasExceededMaxRetries(job, maxRetries = 3) {
  return (job.retry_count || 0) >= maxRetries;
}

/**
 * Calculate exponential backoff delay in milliseconds
 *
 * @param {number} retryCount - Current retry count
 * @param {number} baseDelayMs - Base delay in milliseconds (default: 1000)
 * @returns {number} Delay in milliseconds
 */
export function calculateBackoffDelay(retryCount, baseDelayMs = 1000) {
  // Exponential backoff: 1s, 2s, 4s, 8s, ...
  return baseDelayMs * Math.pow(2, retryCount);
}
