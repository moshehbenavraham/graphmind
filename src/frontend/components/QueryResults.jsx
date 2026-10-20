/**
 * QueryResults Component (T130-T135)
 * Feature 008: Voice Query Input & Graph Querying
 *
 * Displays structured query results with entities, relationships, and metadata.
 * Handles empty results, large result sets, and provides clear information display.
 */

import React, { useState } from 'react';
import { Card, Badge, OffsetLayer, cn } from '../design-system';
import { motion, AnimatePresence } from 'framer-motion';
import { brutalStagger } from '../design-system';

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
      <div className="w-full">
        <OffsetLayer variant="accent" size="md">
          <Card variant="default" className="text-center py-8">
            <Card.Body>
              <svg className="w-12 h-12 mx-auto mb-4 text-brutal-charcoal/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4m0 4h.01"/>
              </svg>
              <h3 className="text-lg font-bold mb-2">NO RESULTS FOUND</h3>
              <p className="font-mono text-sm text-brutal-charcoal/70 max-w-md mx-auto">
                Try a different question or capture more voice notes to build your knowledge graph.
              </p>
            </Card.Body>
          </Card>
        </OffsetLayer>
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
    // Convert WORKS_ON -> "works on"
    return relType.toLowerCase().replace(/_/g, ' ');
  };

  /**
   * Find entity by ID
   */
  const findEntity = (entityId) => {
    return entities.find(e => e.id === entityId);
  };

  return (
    <div className="w-full space-y-6">
      {/* Question display */}
      {question && (
        <div className="terminal-brutal">
          <div className="flex items-start gap-2">
            <span className="text-status-success font-bold">$</span>
            <span className="text-brutal-white">"{question}"</span>
          </div>
        </div>
      )}

      {/* T133: Metadata display (query time, entity count) */}
      {metadata && (
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="accent">
            {metadata.entity_count || entities.length} ENTITIES
          </Badge>
          {metadata.relationship_count !== undefined && (
            <Badge variant="default">
              {metadata.relationship_count} CONNECTIONS
            </Badge>
          )}
          {metadata.execution_time_ms && (
            <Badge variant="info">
              {metadata.execution_time_ms}ms
            </Badge>
          )}
          {metadata.cached && (
            <Badge variant="success" className="flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"/>
              </svg>
              CACHED
            </Badge>
          )}
        </div>
      )}

      {/* T131: Display entities with properties (card layout) */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-bold">ENTITIES ({entities.length})</h3>
          {entities.length >= 100 && (
            <span className="font-mono text-xs text-brutal-charcoal/50">(limited to 100)</span>
          )}
        </div>

        {/* T135: Grid for entities */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2"
          variants={brutalStagger.container}
          initial="hidden"
          animate="show"
        >
          {entities.map((entity) => {
            const isExpanded = expandedEntities.has(entity.id);
            const props = entity.properties || {};
            const propCount = Object.keys(props).length;

            return (
              <motion.div key={entity.id} variants={brutalStagger.item}>
                <Card variant="default" className="h-full">
                  <Card.Body>
                    {/* Entity header */}
                    <div className="mb-3">
                      <Badge variant="accent" className="mb-2">
                        {entity.type}
                      </Badge>
                      <h4 className="font-bold text-base">{entity.name}</h4>
                    </div>

                    {/* Entity properties */}
                    {propCount > 0 && (
                      <div>
                        <button
                          className={cn(
                            'w-full flex items-center justify-between p-2 font-mono text-xs',
                            'border-2 border-brutal-black hover:bg-brutal-black hover:text-brutal-white',
                            'transition-colors'
                          )}
                          onClick={() => toggleEntityExpansion(entity.id)}
                          aria-expanded={isExpanded}
                        >
                          <span>{isExpanded ? 'HIDE' : 'SHOW'} PROPERTIES ({propCount})</span>
                          <svg
                            className={cn(
                              'w-4 h-4 transition-transform',
                              isExpanded && 'rotate-180'
                            )}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 p-3 bg-brutal-cream border-2 border-brutal-black">
                                {Object.entries(props).map(([key, value]) => (
                                  <div key={key} className="flex gap-2 mb-1 last:mb-0 font-mono text-xs">
                                    <span className="font-bold text-accent-primary">{key}:</span>
                                    <span className="text-brutal-charcoal/70 break-all">
                                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* T132: Display relationships between entities */}
      {relationships.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-4">RELATIONSHIPS ({relationships.length})</h3>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {relationships.map((rel, index) => {
              const sourceEntity = findEntity(rel.source);
              const targetEntity = findEntity(rel.target);

              return (
                <Card key={index} variant="default" className="p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Source entity */}
                    <div className="flex-1 min-w-[120px]">
                      <span className="font-bold block">{sourceEntity?.name || rel.source}</span>
                      {sourceEntity?.type && (
                        <Badge variant="default" className="mt-1">
                          {sourceEntity.type}
                        </Badge>
                      )}
                    </div>

                    {/* Relationship arrow */}
                    <div className="flex items-center gap-2 text-accent-primary">
                      <div className="px-3 py-1 bg-brutal-black text-brutal-white font-mono text-xs font-bold">
                        {getRelationshipLabel(rel.type)}
                      </div>
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M5 12h14m-7-7l7 7-7 7"/>
                      </svg>
                    </div>

                    {/* Target entity */}
                    <div className="flex-1 min-w-[120px] text-right">
                      <span className="font-bold block">{targetEntity?.name || rel.target}</span>
                      {targetEntity?.type && (
                        <Badge variant="default" className="mt-1">
                          {targetEntity.type}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Scroll helper for large results */}
      {(entities.length > 10 || relationships.length > 10) && (
        <div className="text-center">
          <span className="font-mono text-xs text-brutal-charcoal/50 bg-brutal-cream px-4 py-2 border-2 border-brutal-black/20">
            SCROLL TO SEE ALL RESULTS
          </span>
        </div>
      )}
    </div>
  );
};

export default QueryResults;
