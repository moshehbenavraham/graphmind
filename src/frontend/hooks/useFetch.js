import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../utils/api';
import { createLogger } from '../utils/logger';

const logger = createLogger('useFetch');

/**
 * Custom hook for data fetching with state management
 *
 * Provides a unified interface for API requests with automatic loading/error handling,
 * built on top of the ApiClient for consistent auth and error behavior.
 *
 * @param {string|Function} endpoint - API endpoint (string) or function returning endpoint
 * @param {Object} options - Configuration options
 * @param {boolean} options.immediate - Fetch on mount (default: true)
 * @param {Array} options.deps - Dependencies that trigger refetch when changed
 * @param {*} options.initialData - Initial data value (default: null)
 * @param {Object} options.fetchOptions - Options passed to api.request (method, body, etc.)
 * @param {Function} options.transform - Transform function for response data
 * @param {Function} options.onSuccess - Callback on successful fetch
 * @param {Function} options.onError - Callback on fetch error
 * @param {boolean} options.skip - Skip fetching (useful for conditional fetching)
 *
 * @returns {Object} Fetch state and utilities
 *
 * @example
 * // Simple GET request
 * const { data, loading, error, refetch } = useFetch('/api/notes');
 *
 * @example
 * // Dynamic endpoint with dependencies
 * const { data, loading } = useFetch(
 *   () => noteId ? `/api/notes/${noteId}` : null,
 *   { deps: [noteId], skip: !noteId }
 * );
 *
 * @example
 * // With transform and callbacks
 * const { data: notes } = useFetch('/api/notes', {
 *   transform: (response) => response.notes,
 *   onSuccess: (data) => console.log('Fetched', data.length, 'notes'),
 *   onError: (err) => showToast(err.message),
 * });
 */
export function useFetch(endpoint, options = {}) {
  const {
    immediate = true,
    deps = [],
    initialData = null,
    fetchOptions = {},
    transform = (data) => data,
    onSuccess,
    onError,
    skip = false,
  } = options;

  // State
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate && !skip);
  const [error, setError] = useState(null);

  // Track if component is mounted to prevent state updates after unmount
  const mountedRef = useRef(true);
  // Track the current request to handle race conditions
  const requestIdRef = useRef(0);

  /**
   * Resolve the endpoint (handles both string and function)
   */
  const resolveEndpoint = useCallback(() => {
    if (typeof endpoint === 'function') {
      return endpoint();
    }
    return endpoint;
  }, [endpoint]);

  /**
   * Execute the fetch request
   */
  const execute = useCallback(async (overrideOptions = {}) => {
    const resolvedEndpoint = resolveEndpoint();

    // Skip if endpoint is null/undefined or skip is true
    if (!resolvedEndpoint || skip) {
      logger.debug('fetch.skip', 'Skipping fetch', {
        endpoint: resolvedEndpoint,
        skip,
      });
      return null;
    }

    // Increment request ID to track this specific request
    const currentRequestId = ++requestIdRef.current;

    logger.debug('fetch.start', 'Starting fetch', {
      endpoint: resolvedEndpoint,
      request_id: currentRequestId,
    });

    setLoading(true);
    setError(null);

    try {
      const mergedOptions = { ...fetchOptions, ...overrideOptions };
      const response = await api.request(resolvedEndpoint, mergedOptions);

      // Check if this is still the latest request and component is mounted
      if (currentRequestId !== requestIdRef.current) {
        logger.debug('fetch.stale', 'Ignoring stale response', {
          endpoint: resolvedEndpoint,
          request_id: currentRequestId,
          latest_id: requestIdRef.current,
        });
        return null;
      }

      if (!mountedRef.current) {
        logger.debug('fetch.unmounted', 'Component unmounted, ignoring response');
        return null;
      }

      // Transform and set data
      const transformedData = transform(response);
      setData(transformedData);
      setError(null);

      logger.debug('fetch.success', 'Fetch successful', {
        endpoint: resolvedEndpoint,
        request_id: currentRequestId,
      });

      // Call success callback
      if (onSuccess) {
        onSuccess(transformedData, response);
      }

      return transformedData;
    } catch (err) {
      // Check if this is still the latest request and component is mounted
      if (currentRequestId !== requestIdRef.current || !mountedRef.current) {
        return null;
      }

      const errorMessage = err.message || 'An error occurred';
      setError(errorMessage);

      logger.error('fetch.error', 'Fetch failed', {
        endpoint: resolvedEndpoint,
        request_id: currentRequestId,
        message: errorMessage,
      });

      // Call error callback
      if (onError) {
        onError(err);
      }

      return null;
    } finally {
      // Only update loading state if this is the latest request
      if (currentRequestId === requestIdRef.current && mountedRef.current) {
        setLoading(false);
      }
    }
  }, [resolveEndpoint, skip, fetchOptions, transform, onSuccess, onError]);

  /**
   * Refetch data (can be called manually)
   */
  const refetch = useCallback((overrideOptions = {}) => {
    return execute(overrideOptions);
  }, [execute]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setLoading(false);
    requestIdRef.current = 0;
  }, [initialData]);

  /**
   * Auto-fetch on mount and when dependencies change
   */
  useEffect(() => {
    if (immediate && !skip) {
      execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate, skip, ...deps]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    // State
    data,
    loading,
    error,

    // Derived state
    isLoading: loading,
    isError: !!error,
    isEmpty: !loading && !error && (data === null || data === undefined || (Array.isArray(data) && data.length === 0)),

    // Actions
    refetch,
    setData,
    clearError,
    reset,
  };
}

/**
 * Helper hook for paginated data fetching
 *
 * Extends useFetch with pagination state management.
 *
 * @param {string} baseEndpoint - Base API endpoint (pagination params appended)
 * @param {Object} options - Configuration options
 * @param {number} options.limit - Items per page (default: 20)
 * @param {number} options.initialOffset - Initial offset (default: 0)
 * @param {string} options.orderBy - Order by field (default: 'created_at_desc')
 * @param {Function} options.extractData - Function to extract data array from response
 * @param {Function} options.extractPagination - Function to extract pagination from response
 *
 * @returns {Object} Paginated fetch state and utilities
 *
 * @example
 * const {
 *   data: notes,
 *   pagination,
 *   loading,
 *   goToPage,
 *   nextPage,
 *   prevPage,
 * } = usePaginatedFetch('/api/notes', {
 *   limit: 20,
 *   extractData: (response) => response.notes,
 * });
 */
export function usePaginatedFetch(baseEndpoint, options = {}) {
  const {
    limit = 20,
    initialOffset = 0,
    orderBy = 'created_at_desc',
    extractData = (response) => response.data || response.items || [],
    extractPagination = (response) => response.pagination || {},
    ...fetchOptions
  } = options;

  // Pagination state
  const [pagination, setPagination] = useState({
    total: 0,
    limit,
    offset: initialOffset,
    has_more: false,
    current_page: 1,
    total_pages: 1,
  });

  // Build endpoint with pagination params
  const buildEndpoint = useCallback(() => {
    const params = new URLSearchParams({
      limit: pagination.limit.toString(),
      offset: pagination.offset.toString(),
      order_by: orderBy,
    });
    return `${baseEndpoint}?${params}`;
  }, [baseEndpoint, pagination.limit, pagination.offset, orderBy]);

  // Use base fetch hook
  const {
    data,
    loading,
    error,
    refetch: baseFetch,
    setData,
    clearError,
    reset: baseReset,
  } = useFetch(buildEndpoint, {
    ...fetchOptions,
    deps: [pagination.offset, pagination.limit],
    transform: (response) => {
      // Update pagination from response
      const paginationData = extractPagination(response);
      const totalPages = Math.ceil((paginationData.total || 0) / (paginationData.limit || limit));

      setPagination((prev) => ({
        total: paginationData.total || prev.total,
        limit: paginationData.limit || prev.limit,
        offset: paginationData.offset ?? prev.offset,
        has_more: paginationData.has_more ?? false,
        current_page: Math.floor((paginationData.offset ?? prev.offset) / (paginationData.limit || prev.limit)) + 1,
        total_pages: totalPages || 1,
      }));

      // Return extracted data
      return extractData(response);
    },
  });

  /**
   * Navigate to specific page
   */
  const goToPage = useCallback((pageNumber) => {
    const newOffset = (pageNumber - 1) * pagination.limit;
    setPagination((prev) => ({
      ...prev,
      offset: newOffset,
    }));
  }, [pagination.limit]);

  /**
   * Go to next page
   */
  const nextPage = useCallback(() => {
    if (pagination.has_more) {
      setPagination((prev) => ({
        ...prev,
        offset: prev.offset + prev.limit,
      }));
    }
  }, [pagination.has_more]);

  /**
   * Go to previous page
   */
  const prevPage = useCallback(() => {
    if (pagination.offset > 0) {
      setPagination((prev) => ({
        ...prev,
        offset: Math.max(0, prev.offset - prev.limit),
      }));
    }
  }, [pagination.offset]);

  /**
   * Reset pagination to initial state
   */
  const resetPagination = useCallback(() => {
    setPagination({
      total: 0,
      limit,
      offset: initialOffset,
      has_more: false,
      current_page: 1,
      total_pages: 1,
    });
    baseReset();
  }, [limit, initialOffset, baseReset]);

  /**
   * Generate page numbers for pagination UI (max 5 visible)
   */
  const getPageNumbers = useCallback(() => {
    const { current_page, total_pages } = pagination;
    const pages = [];

    if (total_pages <= 5) {
      for (let i = 1; i <= total_pages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, current_page - 2);
      let end = Math.min(total_pages, current_page + 2);

      if (current_page <= 3) {
        end = 5;
      } else if (current_page >= total_pages - 2) {
        start = total_pages - 4;
      }

      if (start > 1) {
        pages.push(1);
        if (start > 2) {
          pages.push('...');
        }
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < total_pages) {
        if (end < total_pages - 1) {
          pages.push('...');
        }
        pages.push(total_pages);
      }
    }

    return pages;
  }, [pagination]);

  return {
    // Data state
    data,
    loading,
    error,

    // Pagination state
    pagination,

    // Derived state
    isLoading: loading,
    isError: !!error,
    isEmpty: !loading && !error && (!data || (Array.isArray(data) && data.length === 0)),
    hasNextPage: pagination.has_more,
    hasPrevPage: pagination.offset > 0,

    // Actions
    refetch: baseFetch,
    setData,
    clearError,

    // Pagination actions
    goToPage,
    nextPage,
    prevPage,
    resetPagination,
    getPageNumbers,
  };
}

export default useFetch;
