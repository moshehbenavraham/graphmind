/**
 * QueryResults Component (T130-T135)
 * Feature 008: Voice Query Input & Graph Querying
 *
 * Displays structured query results with entities, relationships, and metadata.
 * Handles empty results, large result sets, and provides clear information display.
 */

import React, { useState } from 'react';
import '../styles/QueryResults.css';

const QueryResults = ({ results, question }) => {
  const [expandedEntities, setExpandedEntities] = useState(new Set());

  if (!results) {
    return null;
  }

  const { entities = [], relationships = [], metadata = {} } = results;

  /**
   * T134: Handle empty results
   */
  if (entities.length === 0 && relationships.length === 0) {
    return (
      <div className="query-results query-results--empty">
        <div className="query-results__empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4m0 4h.01"/>
          </svg>
        </div>
        <h3 className="query-results__empty-title">No Results Found</h3>
        <p className="query-results__empty-message">
          Try a different question or capture more voice notes to build your knowledge graph.
        </p>
      </div>
    );
  }

  /**
   * Toggle entity expansion for property details
   */
  const toggleEntityExpansion = (entityId) => {
    setExpandedEntities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entityId)) {
        newSet.delete(entityId);
      } else {
        newSet.add(entityId);
      }
      return newSet;
    });
  };

  /**
   * Get relationship text for display
   */
  const getRelationshipLabel = (relType) => {
    // Convert WORKS_ON → "works on"
    return relType.toLowerCase().replace(/_/g, ' ');
  };

  /**
   * Find entity by ID
   */
  const findEntity = (entityId) => {
    return entities.find(e => e.id === entityId);
  };

  return (
    <div className="query-results">
      {/* Question display */}
      {question && (
        <div className="query-results__question">
          <span className="query-results__question-label">Your Question:</span>
          <span className="query-results__question-text">"{question}"</span>
        </div>
      )}

      {/* T133: Metadata display (query time, entity count) */}
      {metadata && (
        <div className="query-results__metadata">
          <div className="query-results__metadata-item">
            <span className="query-results__metadata-label">Entities:</span>
            <span className="query-results__metadata-value">{metadata.entity_count || entities.length}</span>
          </div>
          {metadata.relationship_count !== undefined && (
            <div className="query-results__metadata-item">
              <span className="query-results__metadata-label">Connections:</span>
              <span className="query-results__metadata-value">{metadata.relationship_count}</span>
            </div>
          )}
          {metadata.execution_time_ms && (
            <div className="query-results__metadata-item">
              <span className="query-results__metadata-label">Query Time:</span>
              <span className="query-results__metadata-value">{metadata.execution_time_ms}ms</span>
            </div>
          )}
          {metadata.cached && (
            <div className="query-results__metadata-item query-results__metadata-item--cached">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"/>
              </svg>
              <span>Cached</span>
            </div>
          )}
        </div>
      )}

      {/* T131: Display entities with properties (card layout) */}
      <div className="query-results__entities">
        <h3 className="query-results__section-title">
          Entities ({entities.length})
          {entities.length >= 100 && <span className="query-results__section-note">(limited to 100)</span>}
        </h3>

        {/* T135: Pagination/scrolling for large result sets */}
        <div className="query-results__entities-grid">
          {entities.map((entity) => {
            const isExpanded = expandedEntities.has(entity.id);
            const props = entity.properties || {};
            const propCount = Object.keys(props).length;

            return (
              <div key={entity.id} className="query-results__entity-card">
                {/* Entity header */}
                <div className="query-results__entity-header">
                  <div className="query-results__entity-type">{entity.type}</div>
                  <div className="query-results__entity-name">{entity.name}</div>
                </div>

                {/* Entity properties */}
                {propCount > 0 && (
                  <div className="query-results__entity-properties">
                    <button
                      className="query-results__entity-toggle"
                      onClick={() => toggleEntityExpansion(entity.id)}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? 'Hide' : 'Show'} Properties ({propCount})
                      <svg
                        className={`query-results__entity-toggle-icon ${isExpanded ? 'query-results__entity-toggle-icon--expanded' : ''}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="query-results__entity-props-list">
                        {Object.entries(props).map(([key, value]) => (
                          <div key={key} className="query-results__entity-prop">
                            <span className="query-results__entity-prop-key">{key}:</span>
                            <span className="query-results__entity-prop-value">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* T132: Display relationships between entities */}
      {relationships.length > 0 && (
        <div className="query-results__relationships">
          <h3 className="query-results__section-title">
            Relationships ({relationships.length})
          </h3>

          <div className="query-results__relationships-list">
            {relationships.map((rel, index) => {
              const sourceEntity = findEntity(rel.source);
              const targetEntity = findEntity(rel.target);

              return (
                <div key={index} className="query-results__relationship">
                  <div className="query-results__relationship-source">
                    {sourceEntity?.name || rel.source}
                    <span className="query-results__relationship-type-label">
                      {sourceEntity?.type}
                    </span>
                  </div>

                  <div className="query-results__relationship-arrow">
                    <div className="query-results__relationship-type">
                      {getRelationshipLabel(rel.type)}
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14m-7-7l7 7-7 7"/>
                    </svg>
                  </div>

                  <div className="query-results__relationship-target">
                    {targetEntity?.name || rel.target}
                    <span className="query-results__relationship-type-label">
                      {targetEntity?.type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scroll helper for large results */}
      {(entities.length > 10 || relationships.length > 10) && (
        <div className="query-results__scroll-hint">
          Scroll to see all results
        </div>
      )}
    </div>
  );
};

export default QueryResults;
