import React, { useState, useEffect } from 'react';
import '../styles/note-detail.css';

/**
 * NoteDetail Component (Tasks T092-T098)
 *
 * Displays full details of a single voice note with delete functionality.
 * Fetches note from GET /api/notes/:note_id endpoint.
 *
 * Features:
 * - T092: Fetch full note from API when noteId prop changes
 * - T093: Display full transcript with formatting
 * - T094: Show all metadata (duration, word count, date, status)
 * - T095: Delete button with confirmation modal
 * - T096: Handle DELETE /api/notes/:note_id request
 * - T097: Remove from list without full refresh (callback)
 * - T098: Back navigation to list
 *
 * Test Scenarios (T099-T104):
 * - T103: Note detail view loads correctly with full transcript
 * - T104: Empty state when no note selected
 */
const NoteDetail = ({ noteId, onBack, onNoteDeleted, authToken }) => {
  // State management
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  /**
   * T092: Fetch note when noteId changes
   */
  useEffect(() => {
    if (noteId) {
      fetchNote();
    } else {
      setNote(null);
      setLoading(false);
    }
  }, [noteId]);

  /**
   * Fetch note details from API
   */
  const fetchNote = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to view this note.');
        } else if (response.status === 404) {
          throw new Error('Note not found. It may have been deleted.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`Failed to load note (${response.status})`);
        }
      }

      const data = await response.json();
      setNote(data);
    } catch (err) {
      console.error('Failed to fetch note:', err);
      setError(err.message || 'Failed to load note. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * T095: Show delete confirmation modal
   */
  const handleDeleteClick = () => {
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  /**
   * T095: Cancel delete
   */
  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setDeleteError(null);
  };

  /**
   * T096: Delete note via API
   */
  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);
      setDeleteError(null);

      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to delete this note.');
        } else if (response.status === 404) {
          throw new Error('Note not found. It may have already been deleted.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`Failed to delete note (${response.status})`);
        }
      }

      // T097: Notify parent to remove from list without full refresh
      if (onNoteDeleted) {
        onNoteDeleted(noteId);
      }

      // Close modal
      setShowDeleteModal(false);

      // T098: Navigate back to list
      if (onBack) {
        onBack();
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
      setDeleteError(err.message || 'Failed to delete note. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  /**
   * T094: Format date in full format
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  /**
   * T094: Format duration in human-readable format
   */
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (mins === 0) {
      return `${secs} second${secs !== 1 ? 's' : ''}`;
    } else if (secs === 0) {
      return `${mins} minute${mins !== 1 ? 's' : ''}`;
    } else {
      return `${mins} minute${mins !== 1 ? 's' : ''}, ${secs} second${secs !== 1 ? 's' : ''}`;
    }
  };

  /**
   * T094: Format word count with comma separators
   */
  const formatWordCount = (count) => {
    if (!count) return '0 words';
    return `${count.toLocaleString()} word${count !== 1 ? 's' : ''}`;
  };

  /**
   * T094: Get status badge color
   */
  const getStatusClass = (status) => {
    switch (status) {
      case 'completed':
        return 'note-detail__status--completed';
      case 'pending':
        return 'note-detail__status--pending';
      case 'failed':
        return 'note-detail__status--failed';
      default:
        return '';
    }
  };

  /**
   * T093: Format transcript with paragraphs
   * Split transcript on double line breaks or long sentences
   */
  const formatTranscript = (text) => {
    if (!text) return '';

    // Split on double line breaks first
    let paragraphs = text.split(/\n\n+/);

    // If no double line breaks, try to split into reasonable paragraphs
    if (paragraphs.length === 1 && text.length > 200) {
      // Split on sentence endings followed by space and capital letter
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      paragraphs = [];
      let currentParagraph = '';

      sentences.forEach((sentence) => {
        currentParagraph += sentence;
        // Start new paragraph every 3-4 sentences or 300 characters
        if (currentParagraph.length > 300 || (currentParagraph.match(/[.!?]/g) || []).length >= 4) {
          paragraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
      });

      if (currentParagraph) {
        paragraphs.push(currentParagraph.trim());
      }
    }

    return paragraphs;
  };

  // T104: Empty state when no note selected
  if (!noteId) {
    return (
      <div className="note-detail">
        <div className="note-detail__empty">
          <svg className="note-detail__empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>Select a note to view details</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="note-detail">
        <div className="note-detail__loading">
          <div className="note-detail__spinner"></div>
          <p>Loading note...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="note-detail">
        <div className="note-detail__error" role="alert">
          <svg className="note-detail__error-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="note-detail__error-content">
            <h3>Failed to Load Note</h3>
            <p>{error}</p>
            <div className="note-detail__error-actions">
              <button onClick={fetchNote} className="note-detail__retry-button">
                Try Again
              </button>
              <button onClick={onBack} className="note-detail__back-button">
                Back to List
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main note detail view
  return (
    <div className="note-detail">
      {/* T098: Back button */}
      <button
        className="note-detail__back"
        onClick={onBack}
        aria-label="Back to notes list"
      >
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to Notes
      </button>

      {/* T094: Metadata header */}
      <div className="note-detail__header">
        <div className="note-detail__meta-row">
          <span className="note-detail__date">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            {formatDate(note.created_at)}
          </span>

          <span className={`note-detail__status ${getStatusClass(note.processing_status)}`}>
            {note.processing_status}
          </span>
        </div>

        <div className="note-detail__stats">
          <div className="note-detail__stat">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <span>{formatDuration(note.duration_seconds || 0)}</span>
          </div>

          <div className="note-detail__stat">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
            <span>{formatWordCount(note.word_count || 0)}</span>
          </div>
        </div>
      </div>

      {/* T093: Full transcript with formatting */}
      <div className="note-detail__content">
        <h2 className="note-detail__title">Transcript</h2>
        <div className="note-detail__transcript">
          {formatTranscript(note.transcript).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>

      {/* T095: Delete button */}
      <div className="note-detail__actions">
        <button
          className="note-detail__delete-button"
          onClick={handleDeleteClick}
          aria-label="Delete note"
        >
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Delete Note
        </button>
      </div>

      {/* T095: Delete confirmation modal */}
      {showDeleteModal && (
        <div className="note-detail__modal-overlay" onClick={handleDeleteCancel}>
          <div className="note-detail__modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="delete-modal-title" aria-modal="true">
            <div className="note-detail__modal-header">
              <h3 id="delete-modal-title">Delete Note?</h3>
              <button
                className="note-detail__modal-close"
                onClick={handleDeleteCancel}
                aria-label="Close modal"
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="note-detail__modal-content">
              <p>Are you sure you want to delete this note? This action cannot be undone.</p>

              <div className="note-detail__modal-preview">
                <p>{note.transcript.substring(0, 150)}...</p>
              </div>

              {deleteError && (
                <div className="note-detail__modal-error" role="alert">
                  {deleteError}
                </div>
              )}
            </div>

            <div className="note-detail__modal-actions">
              <button
                className="note-detail__modal-button note-detail__modal-button--cancel"
                onClick={handleDeleteCancel}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="note-detail__modal-button note-detail__modal-button--delete"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <div className="note-detail__button-spinner"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteDetail;
