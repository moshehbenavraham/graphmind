import React, { useState, useCallback } from 'react';
import { Card, Button, Badge, cn } from '../design-system';
import { motion, AnimatePresence } from 'framer-motion';
import { brutalEnter, brutalExit } from '../design-system';
import { useFetch } from '../hooks/useFetch';
import { api } from '../utils/api';
import { createLogger } from '../utils/logger';

const logger = createLogger('NoteDetail');

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
 * Refactored to use useFetch hook for data fetching (Phase 2).
 */
const NoteDetail = ({ noteId, onBack, onNoteDeleted }) => {
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  /**
   * T092: Fetch note using useFetch hook
   * Automatically refetches when noteId changes
   */
  const {
    data: note,
    loading,
    error,
    refetch,
  } = useFetch(
    () => noteId ? `/api/notes/${noteId}` : null,
    {
      deps: [noteId],
      skip: !noteId,
      onError: (err) => {
        logger.error('fetch.error', 'Failed to fetch note', { noteId, message: err.message });
      },
    }
  );

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
  const handleDeleteConfirm = useCallback(async () => {
    try {
      setDeleting(true);
      setDeleteError(null);

      logger.info('delete.start', 'Deleting note', { noteId });
      await api.request(`/api/notes/${noteId}`, { method: 'DELETE' });
      logger.info('delete.success', 'Note deleted', { noteId });

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
      logger.error('delete.error', 'Failed to delete note', { noteId, message: err.message });
      setDeleteError(err.message || 'Failed to delete note. Please try again.');
    } finally {
      setDeleting(false);
    }
  }, [noteId, onNoteDeleted, onBack]);

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
   * T094: Get status badge variant
   */
  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  /**
   * T093: Format transcript with paragraphs
   * Split transcript on double line breaks or long sentences
   */
  const formatTranscript = (text) => {
    if (!text) return [];

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
      <div className="w-full max-w-3xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Card variant="default" className="p-8">
            <svg className="w-16 h-16 mx-auto mb-6 text-brutal-charcoal/50" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-mono text-brutal-charcoal/70">Select a note to view details</p>
          </Card>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="w-full max-w-3xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="loading-brutal" />
          <p className="font-mono text-brutal-charcoal/70">Loading note...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full max-w-3xl mx-auto p-6">
        <Card variant="default" className="border-status-error">
          <Card.Body>
            <div className="flex items-start gap-4">
              <svg className="w-6 h-6 flex-shrink-0 text-status-error" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-status-error mb-1">FAILED TO LOAD NOTE</h3>
                <p className="font-mono text-sm text-brutal-charcoal/70 mb-4">{error}</p>
                <div className="flex gap-3">
                  <Button variant="danger" onClick={refetch}>
                    TRY AGAIN
                  </Button>
                  <Button variant="secondary" onClick={onBack}>
                    BACK TO LIST
                  </Button>
                </div>
              </div>
            </div>
          </Card.Body>
        </Card>
      </div>
    );
  }

  // Main note detail view
  return (
    <div className="w-full max-w-3xl mx-auto p-6">
      {/* T098: Back button */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-6 flex items-center gap-2"
        aria-label="Back to notes list"
      >
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        BACK TO NOTES
      </Button>

      {/* T094: Metadata header */}
      <Card variant="default" className="mb-6">
        <Card.Body>
          <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-brutal-black/20">
            <span className="flex items-center gap-2 font-mono text-sm text-brutal-charcoal/70">
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              {formatDate(note.created_at)}
            </span>

            <Badge variant={getStatusBadgeVariant(note.processing_status)}>
              {note.processing_status}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2 font-mono text-sm text-brutal-charcoal/70">
              <svg className="w-5 h-5 text-brutal-charcoal/50" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span>{formatDuration(note.duration_seconds || 0)}</span>
            </div>

            <div className="flex items-center gap-2 font-mono text-sm text-brutal-charcoal/70">
              <svg className="w-5 h-5 text-brutal-charcoal/50" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              <span>{formatWordCount(note.word_count || 0)}</span>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* T093: Full transcript with formatting */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-4">TRANSCRIPT</h2>
        <Card variant="default">
          <Card.Body className="leading-relaxed">
            {formatTranscript(note.transcript).map((paragraph, index) => (
              <p key={index} className="font-mono text-sm mb-4 last:mb-0">
                {paragraph}
              </p>
            ))}
          </Card.Body>
        </Card>
      </div>

      {/* T095: Delete button */}
      <div className="flex justify-end pt-6 border-t-4 border-brutal-black">
        <Button
          variant="danger"
          onClick={handleDeleteClick}
          className="flex items-center gap-2"
          aria-label="Delete note"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          DELETE NOTE
        </Button>
      </div>

      {/* T095: Delete confirmation modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            className="modal-overlay-brutal"
            onClick={handleDeleteCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="modal-brutal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="delete-modal-title"
              aria-modal="true"
              initial={brutalEnter.initial}
              animate={brutalEnter.animate}
              exit={brutalExit.exit}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-brutal-black">
                <h3 id="delete-modal-title" className="text-lg font-bold">DELETE NOTE?</h3>
                <button
                  className="p-1 hover:bg-brutal-black hover:text-brutal-white transition-colors"
                  onClick={handleDeleteCancel}
                  aria-label="Close modal"
                >
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Modal content */}
              <div className="mb-6">
                <p className="font-mono text-sm text-brutal-charcoal/70 mb-4">
                  Are you sure you want to delete this note? This action cannot be undone.
                </p>

                <div className="p-4 bg-brutal-cream border-l-4 border-status-error">
                  <p className="font-mono text-sm text-brutal-charcoal/70 italic line-clamp-3">
                    {note.transcript.substring(0, 150)}...
                  </p>
                </div>

                {deleteError && (
                  <Badge variant="error" className="mt-4 w-full justify-center">
                    {deleteError}
                  </Badge>
                )}
              </div>

              {/* Modal actions */}
              <div className="flex justify-end gap-4">
                <Button
                  variant="secondary"
                  onClick={handleDeleteCancel}
                  disabled={deleting}
                >
                  CANCEL
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  loading={deleting}
                >
                  {deleting ? 'DELETING...' : 'DELETE'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NoteDetail;
