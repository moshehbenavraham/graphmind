import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, GlitchText, OffsetLayer, cn } from '../design-system';
import { motion, AnimatePresence } from 'framer-motion';
import { brutalStagger } from '../design-system';

/**
 * NotesList Component (Tasks T085-T091)
 *
 * Displays a paginated list of user's voice notes with metadata.
 * Fetches notes from GET /api/notes endpoint with proper authentication.
 *
 * Features:
 * - T085: Fetch notes from API on component mount
 * - T086: Display in reverse chronological order
 * - T087: Show excerpt (first 100 chars) with ellipsis
 * - T088: Show metadata (duration, word count, formatted date)
 * - T089: Pagination controls (prev/next, page numbers)
 * - T090: Empty state with onboarding message
 * - T091: Loading and error state handling
 */
const NotesList = ({ onNoteSelect, authToken }) => {
  // State management
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    has_more: false,
    current_page: 1,
    total_pages: 1
  });

  /**
   * T085: Fetch notes from API on mount and when pagination changes
   */
  useEffect(() => {
    fetchNotes();
  }, [pagination.offset]);

  /**
   * Fetch notes from API endpoint
   */
  const fetchNotes = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
        order_by: 'created_at_desc'
      });

      // Make API request
      const response = await fetch(`/api/notes?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Please log in again.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`Failed to load notes (${response.status})`);
        }
      }

      const data = await response.json();

      // T086: Notes are already in reverse chronological order from API
      setNotes(data.notes || []);

      // Update pagination state
      const totalPages = Math.ceil(data.pagination.total / data.pagination.limit);
      setPagination({
        total: data.pagination.total,
        limit: data.pagination.limit,
        offset: data.pagination.offset,
        has_more: data.pagination.has_more,
        current_page: Math.floor(data.pagination.offset / data.pagination.limit) + 1,
        total_pages: totalPages
      });
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      setError(err.message || 'Failed to load notes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * T089: Navigate to next page
   */
  const handleNextPage = () => {
    if (pagination.has_more) {
      setPagination(prev => ({
        ...prev,
        offset: prev.offset + prev.limit
      }));
    }
  };

  /**
   * T089: Navigate to previous page
   */
  const handlePrevPage = () => {
    if (pagination.offset > 0) {
      setPagination(prev => ({
        ...prev,
        offset: Math.max(0, prev.offset - prev.limit)
      }));
    }
  };

  /**
   * T089: Jump to specific page
   */
  const handlePageClick = (pageNumber) => {
    const newOffset = (pageNumber - 1) * pagination.limit;
    setPagination(prev => ({
      ...prev,
      offset: newOffset
    }));
  };

  /**
   * T087: Truncate transcript to excerpt (first 100 chars)
   */
  const getExcerpt = (transcript) => {
    if (!transcript) return '';
    if (transcript.length <= 100) return transcript;
    return transcript.substring(0, 100) + '...';
  };

  /**
   * T088: Format date in user-friendly format
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' +
             date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  /**
   * T088: Format duration in MM:SS format
   */
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * T088: Format word count with comma separators
   */
  const formatWordCount = (count) => {
    if (!count) return '0 words';
    return `${count.toLocaleString()} word${count !== 1 ? 's' : ''}`;
  };

  /**
   * T089: Generate page number buttons (show max 5 pages at a time)
   */
  const getPageNumbers = () => {
    const { current_page, total_pages } = pagination;
    const pages = [];

    if (total_pages <= 5) {
      // Show all pages if 5 or fewer
      for (let i = 1; i <= total_pages; i++) {
        pages.push(i);
      }
    } else {
      // Show current page and 2 before/after
      let start = Math.max(1, current_page - 2);
      let end = Math.min(total_pages, current_page + 2);

      // Adjust if at start or end
      if (current_page <= 3) {
        end = 5;
      } else if (current_page >= total_pages - 2) {
        start = total_pages - 4;
      }

      // Add first page and ellipsis if needed
      if (start > 1) {
        pages.push(1);
        if (start > 2) {
          pages.push('...');
        }
      }

      // Add page range
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis and last page if needed
      if (end < total_pages) {
        if (end < total_pages - 1) {
          pages.push('...');
        }
        pages.push(total_pages);
      }
    }

    return pages;
  };

  /**
   * Handle note click
   */
  const handleNoteClick = (noteId) => {
    if (onNoteSelect) {
      onNoteSelect(noteId);
    }
  };

  // T091: Loading state
  if (loading && notes.length === 0) {
    return (
      <div className="w-full max-w-5xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
          <div className="loading-brutal" />
          <p className="font-mono text-brutal-charcoal/70">Loading your notes...</p>
        </div>
      </div>
    );
  }

  // T091: Error state
  if (error) {
    return (
      <div className="w-full max-w-5xl mx-auto p-6">
        <Card variant="default" className="border-status-error">
          <Card.Body>
            <div className="flex items-start gap-4">
              <svg className="w-6 h-6 flex-shrink-0 text-status-error" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-status-error mb-1">FAILED TO LOAD NOTES</h3>
                <p className="font-mono text-sm text-brutal-charcoal/70 mb-4">{error}</p>
                <Button variant="danger" onClick={fetchNotes}>
                  TRY AGAIN
                </Button>
              </div>
            </div>
          </Card.Body>
        </Card>
      </div>
    );
  }

  // T090: Empty state
  if (notes.length === 0) {
    return (
      <div className="w-full max-w-5xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <OffsetLayer variant="accent" size="lg">
            <Card variant="default" className="p-8">
              <svg className="w-16 h-16 mx-auto mb-6 text-brutal-charcoal/50" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <h3 className="text-xl font-bold mb-2">NO VOICE NOTES YET</h3>
              <p className="font-mono text-sm text-brutal-charcoal/70 mb-2 max-w-sm">
                Start capturing your thoughts by recording your first voice note.
              </p>
              <p className="font-mono text-xs text-brutal-charcoal/50 max-w-sm">
                Click the "Start Recording" button to begin. Your notes will appear here.
              </p>
            </Card>
          </OffsetLayer>
        </div>
      </div>
    );
  }

  // Main notes list view
  return (
    <div className="w-full max-w-5xl mx-auto p-6 relative">
      {/* Header with count */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b-4 border-brutal-black">
        <GlitchText as="h2" className="text-2xl">
          Your Voice Notes
        </GlitchText>
        <Badge variant="accent">
          {pagination.total} {pagination.total === 1 ? 'note' : 'notes'}
        </Badge>
      </div>

      {/* T086, T087, T088: Notes grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
        variants={brutalStagger.container}
        initial="hidden"
        animate="show"
      >
        <AnimatePresence mode="popLayout">
          {notes.map((note, index) => (
            <motion.div
              key={note.note_id}
              variants={brutalStagger.item}
              layout
            >
              <Card
                interactive
                onClick={() => handleNoteClick(note.note_id)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleNoteClick(note.note_id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View note from ${formatDate(note.created_at)}`}
              >
                <Card.Body>
                  {/* T087: Excerpt */}
                  <p className="font-mono text-sm leading-relaxed text-brutal-charcoal mb-4 min-h-[4.5rem] line-clamp-3">
                    {getExcerpt(note.transcript)}
                  </p>

                  {/* T088: Metadata */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t-2 border-brutal-black/20 text-xs font-mono text-brutal-charcoal/70">
                    <span className="flex items-center gap-1" title="Duration">
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      <span className="tabular-nums">{formatDuration(note.duration_seconds || 0)}</span>
                    </span>

                    <span className="flex items-center gap-1" title="Word count">
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      {formatWordCount(note.word_count || 0)}
                    </span>

                    <span className="flex items-center gap-1" title={new Date(note.created_at).toLocaleString()}>
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      {formatDate(note.created_at)}
                    </span>
                  </div>
                </Card.Body>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* T089: Pagination controls */}
      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-6 border-t-4 border-brutal-black">
          <Button
            variant="secondary"
            onClick={handlePrevPage}
            disabled={pagination.current_page === 1}
            aria-label="Previous page"
            className="flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            PREV
          </Button>

          <div className="flex gap-1">
            {getPageNumbers().map((page, index) => (
              page === '...' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="flex items-center justify-center w-10 h-10 font-mono font-bold text-brutal-charcoal/50"
                >
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  className={cn(
                    'w-10 h-10 font-mono font-bold border-3 border-brutal-black transition-all',
                    page === pagination.current_page
                      ? 'bg-accent-primary text-brutal-black'
                      : 'bg-brutal-white text-brutal-black hover:bg-brutal-black hover:text-brutal-white'
                  )}
                  onClick={() => handlePageClick(page)}
                  aria-label={`Page ${page}`}
                  aria-current={page === pagination.current_page ? 'page' : undefined}
                >
                  {page}
                </button>
              )
            ))}
          </div>

          <Button
            variant="secondary"
            onClick={handleNextPage}
            disabled={!pagination.has_more}
            aria-label="Next page"
            className="flex items-center gap-2"
          >
            NEXT
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </Button>
        </div>
      )}

      {/* Loading overlay during pagination */}
      {loading && notes.length > 0 && (
        <div className="absolute inset-0 bg-brutal-cream/80 flex items-center justify-center z-10">
          <div className="loading-brutal" />
        </div>
      )}
    </div>
  );
};

export default NotesList;
