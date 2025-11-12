/**
 * Performance Testing - Create 1,000 Entity Test Dataset
 *
 * Generates realistic test data for performance validation:
 * - 100 Person entities
 * - 50 Project entities
 * - 30 Meeting entities
 * - 200 Topic entities
 * - 200 Technology entities
 * - 100 Organization entities
 * - 320 Document entities
 *
 * Tests US3 acceptance criteria:
 * - Uncached queries: <500ms p95
 * - Cached queries: <100ms p95
 * - Cache hit rate: >70%
 * - No degradation with 1000+ entities
 */

import { faker } from '@faker-js/faker';

const ENTITY_COUNTS = {
  Person: 100,
  Project: 50,
  Meeting: 30,
  Topic: 200,
  Technology: 200,
  Organization: 100,
  Document: 320
};

const TECHNOLOGIES = [
  'JavaScript', 'Python', 'React', 'Node.js', 'PostgreSQL',
  'Redis', 'Docker', 'Kubernetes', 'AWS', 'FalkorDB',
  'TypeScript', 'GraphQL', 'REST API', 'WebSocket', 'OAuth',
  'JWT', 'Cloudflare Workers', 'Durable Objects', 'D1', 'KV',
  'Machine Learning', 'TensorFlow', 'PyTorch', 'Deepgram', 'Llama'
];

const TOPICS = [
  'Software Architecture', 'Database Design', 'API Development',
  'Cloud Computing', 'DevOps', 'Security', 'Performance Optimization',
  'Testing', 'CI/CD', 'Microservices', 'Serverless', 'Graph Databases',
  'Voice AI', 'Natural Language Processing', 'Knowledge Graphs',
  'RAG Systems', 'Entity Extraction', 'Data Modeling'
];

const PROJECT_TYPES = [
  'Web Application', 'Mobile App', 'API Service', 'Data Pipeline',
  'Machine Learning Model', 'Infrastructure', 'CLI Tool', 'Library'
];

const MEETING_TYPES = [
  'Planning Session', 'Design Review', 'Sprint Retrospective',
  '1:1 Meeting', 'Team Sync', 'Architecture Review', 'Demo',
  'Brainstorming', 'Code Review', 'Technical Discussion'
];

/**
 * Generate Person entities
 */
function generatePersons(count) {
  const persons = [];
  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    persons.push({
      entity_type: 'Person',
      name: `${firstName} ${lastName}`,
      properties: {
        email: faker.internet.email({ firstName, lastName }),
        role: faker.person.jobTitle(),
        company: faker.company.name()
      },
      mention_count: faker.number.int({ min: 1, max: 50 })
    });
  }
  return persons;
}

/**
 * Generate Project entities
 */
function generateProjects(count) {
  const projects = [];
  for (let i = 0; i < count; i++) {
    projects.push({
      entity_type: 'Project',
      name: faker.company.catchPhrase().slice(0, 50),
      properties: {
        type: faker.helpers.arrayElement(PROJECT_TYPES),
        status: faker.helpers.arrayElement(['Planning', 'Active', 'On Hold', 'Completed']),
        priority: faker.helpers.arrayElement(['Low', 'Medium', 'High', 'Critical']),
        start_date: faker.date.past({ years: 2 }).toISOString().split('T')[0]
      },
      mention_count: faker.number.int({ min: 1, max: 100 })
    });
  }
  return projects;
}

/**
 * Generate Meeting entities
 */
function generateMeetings(count) {
  const meetings = [];
  for (let i = 0; i < count; i++) {
    meetings.push({
      entity_type: 'Meeting',
      name: `${faker.helpers.arrayElement(MEETING_TYPES)} - ${faker.date.recent({ days: 30 }).toLocaleDateString()}`,
      properties: {
        type: faker.helpers.arrayElement(MEETING_TYPES),
        date: faker.date.recent({ days: 60 }).toISOString().split('T')[0],
        duration_minutes: faker.helpers.arrayElement([30, 45, 60, 90]),
        attendee_count: faker.number.int({ min: 2, max: 15 })
      },
      mention_count: faker.number.int({ min: 1, max: 20 })
    });
  }
  return meetings;
}

/**
 * Generate Topic entities
 */
function generateTopics(count) {
  const topics = [];
  const baseTopics = [...TOPICS];

  // Generate variations and combinations
  for (let i = 0; i < count; i++) {
    const baseTopic = faker.helpers.arrayElement(baseTopics);
    const variation = i % 3 === 0 ?
      `${baseTopic} Best Practices` :
      i % 3 === 1 ?
      `Advanced ${baseTopic}` :
      baseTopic;

    topics.push({
      entity_type: 'Topic',
      name: variation,
      properties: {
        category: faker.helpers.arrayElement(['Technical', 'Process', 'Business', 'Research']),
        complexity: faker.helpers.arrayElement(['Beginner', 'Intermediate', 'Advanced', 'Expert'])
      },
      mention_count: faker.number.int({ min: 1, max: 80 })
    });
  }
  return topics;
}

/**
 * Generate Technology entities
 */
function generateTechnologies(count) {
  const technologies = [];
  const baseTechs = [...TECHNOLOGIES];

  for (let i = 0; i < count; i++) {
    const baseTech = faker.helpers.arrayElement(baseTechs);
    const version = i % 4 === 0 ? ` ${faker.system.semver()}` : '';

    technologies.push({
      entity_type: 'Technology',
      name: `${baseTech}${version}`,
      properties: {
        category: faker.helpers.arrayElement(['Language', 'Framework', 'Database', 'Tool', 'Service']),
        maturity: faker.helpers.arrayElement(['Experimental', 'Stable', 'Mature', 'Legacy']),
        license: faker.helpers.arrayElement(['MIT', 'Apache 2.0', 'GPL', 'Proprietary'])
      },
      mention_count: faker.number.int({ min: 1, max: 120 })
    });
  }
  return technologies;
}

/**
 * Generate Organization entities
 */
function generateOrganizations(count) {
  const organizations = [];
  for (let i = 0; i < count; i++) {
    organizations.push({
      entity_type: 'Organization',
      name: faker.company.name(),
      properties: {
        industry: faker.commerce.department(),
        size: faker.helpers.arrayElement(['Startup', 'Small', 'Medium', 'Enterprise']),
        location: faker.location.city()
      },
      mention_count: faker.number.int({ min: 1, max: 60 })
    });
  }
  return organizations;
}

/**
 * Generate Document entities
 */
function generateDocuments(count) {
  const documents = [];
  const docTypes = ['Specification', 'Design Doc', 'RFC', 'Wiki Page', 'API Docs', 'Tutorial', 'README'];

  for (let i = 0; i < count; i++) {
    documents.push({
      entity_type: 'Document',
      name: `${faker.helpers.arrayElement(docTypes)}: ${faker.company.catchPhrase().slice(0, 40)}`,
      properties: {
        type: faker.helpers.arrayElement(docTypes),
        status: faker.helpers.arrayElement(['Draft', 'In Review', 'Published', 'Archived']),
        author: faker.person.fullName(),
        created_date: faker.date.past({ years: 1 }).toISOString().split('T')[0]
      },
      mention_count: faker.number.int({ min: 1, max: 40 })
    });
  }
  return documents;
}

/**
 * Generate all entities
 */
export function generateTestDataset() {
  const dataset = {
    entities: [],
    metadata: {
      total_count: 0,
      counts_by_type: {},
      generated_at: new Date().toISOString()
    }
  };

  // Generate all entity types
  const persons = generatePersons(ENTITY_COUNTS.Person);
  const projects = generateProjects(ENTITY_COUNTS.Project);
  const meetings = generateMeetings(ENTITY_COUNTS.Meeting);
  const topics = generateTopics(ENTITY_COUNTS.Topic);
  const technologies = generateTechnologies(ENTITY_COUNTS.Technology);
  const organizations = generateOrganizations(ENTITY_COUNTS.Organization);
  const documents = generateDocuments(ENTITY_COUNTS.Document);

  // Combine all entities
  dataset.entities = [
    ...persons,
    ...projects,
    ...meetings,
    ...topics,
    ...technologies,
    ...organizations,
    ...documents
  ];

  // Add unique IDs
  dataset.entities = dataset.entities.map((entity, index) => ({
    ...entity,
    entity_id: `test_entity_${String(index + 1).padStart(4, '0')}`
  }));

  // Update metadata
  dataset.metadata.total_count = dataset.entities.length;
  dataset.metadata.counts_by_type = {
    Person: persons.length,
    Project: projects.length,
    Meeting: meetings.length,
    Topic: topics.length,
    Technology: technologies.length,
    Organization: organizations.length,
    Document: documents.length
  };

  return dataset;
}

/**
 * Generate relationships between entities
 */
export function generateRelationships(entities) {
  const relationships = [];

  // Get entities by type
  const byType = entities.reduce((acc, entity) => {
    if (!acc[entity.entity_type]) acc[entity.entity_type] = [];
    acc[entity.entity_type].push(entity);
    return acc;
  }, {});

  // Person → Organization (WORKS_AT)
  byType.Person?.forEach(person => {
    if (Math.random() > 0.3) {
      const org = faker.helpers.arrayElement(byType.Organization || []);
      if (org) {
        relationships.push({
          source_id: person.entity_id,
          target_id: org.entity_id,
          relationship_type: 'WORKS_AT',
          properties: {
            role: person.properties.role,
            since: faker.date.past({ years: 3 }).toISOString().split('T')[0]
          }
        });
      }
    }
  });

  // Person → Project (WORKS_ON)
  byType.Person?.forEach(person => {
    const numProjects = faker.number.int({ min: 1, max: 4 });
    for (let i = 0; i < numProjects; i++) {
      const project = faker.helpers.arrayElement(byType.Project || []);
      if (project && Math.random() > 0.2) {
        relationships.push({
          source_id: person.entity_id,
          target_id: project.entity_id,
          relationship_type: 'WORKS_ON',
          properties: {
            role: faker.helpers.arrayElement(['Lead', 'Developer', 'Contributor']),
            contribution: faker.helpers.arrayElement(['High', 'Medium', 'Low'])
          }
        });
      }
    }
  });

  // Person → Meeting (ATTENDED)
  byType.Person?.forEach(person => {
    const numMeetings = faker.number.int({ min: 2, max: 8 });
    for (let i = 0; i < numMeetings; i++) {
      const meeting = faker.helpers.arrayElement(byType.Meeting || []);
      if (meeting && Math.random() > 0.4) {
        relationships.push({
          source_id: person.entity_id,
          target_id: meeting.entity_id,
          relationship_type: 'ATTENDED',
          properties: {
            role: faker.helpers.arrayElement(['Organizer', 'Participant', 'Observer'])
          }
        });
      }
    }
  });

  // Project → Technology (USES_TECHNOLOGY)
  byType.Project?.forEach(project => {
    const numTechs = faker.number.int({ min: 2, max: 8 });
    for (let i = 0; i < numTechs; i++) {
      const tech = faker.helpers.arrayElement(byType.Technology || []);
      if (tech && Math.random() > 0.3) {
        relationships.push({
          source_id: project.entity_id,
          target_id: tech.entity_id,
          relationship_type: 'USES_TECHNOLOGY',
          properties: {
            importance: faker.helpers.arrayElement(['Core', 'Supporting', 'Optional'])
          }
        });
      }
    }
  });

  // Project → Topic (RELATES_TO)
  byType.Project?.forEach(project => {
    const numTopics = faker.number.int({ min: 1, max: 5 });
    for (let i = 0; i < numTopics; i++) {
      const topic = faker.helpers.arrayElement(byType.Topic || []);
      if (topic && Math.random() > 0.4) {
        relationships.push({
          source_id: project.entity_id,
          target_id: topic.entity_id,
          relationship_type: 'RELATES_TO',
          properties: {
            relevance: faker.helpers.arrayElement(['High', 'Medium', 'Low'])
          }
        });
      }
    }
  });

  // Meeting → Topic (DISCUSSED)
  byType.Meeting?.forEach(meeting => {
    const numTopics = faker.number.int({ min: 1, max: 4 });
    for (let i = 0; i < numTopics; i++) {
      const topic = faker.helpers.arrayElement(byType.Topic || []);
      if (topic && Math.random() > 0.3) {
        relationships.push({
          source_id: meeting.entity_id,
          target_id: topic.entity_id,
          relationship_type: 'DISCUSSED',
          properties: {
            duration_minutes: faker.number.int({ min: 5, max: 45 })
          }
        });
      }
    }
  });

  // Document → Technology (DOCUMENTS)
  byType.Document?.forEach(doc => {
    const numTechs = faker.number.int({ min: 1, max: 3 });
    for (let i = 0; i < numTechs; i++) {
      const tech = faker.helpers.arrayElement(byType.Technology || []);
      if (tech && Math.random() > 0.4) {
        relationships.push({
          source_id: doc.entity_id,
          target_id: tech.entity_id,
          relationship_type: 'DOCUMENTS',
          properties: {
            completeness: faker.helpers.arrayElement(['Comprehensive', 'Partial', 'Overview'])
          }
        });
      }
    }
  });

  // Person → Person (COLLABORATES_WITH)
  byType.Person?.forEach(person => {
    const numCollabs = faker.number.int({ min: 0, max: 5 });
    for (let i = 0; i < numCollabs; i++) {
      const other = faker.helpers.arrayElement(byType.Person || []);
      if (other && other.entity_id !== person.entity_id && Math.random() > 0.5) {
        relationships.push({
          source_id: person.entity_id,
          target_id: other.entity_id,
          relationship_type: 'COLLABORATES_WITH',
          properties: {
            strength: faker.helpers.arrayElement(['Strong', 'Moderate', 'Weak'])
          }
        });
      }
    }
  });

  return relationships;
}

/**
 * Save dataset to file
 */
export async function saveDataset(dataset, filename = 'performance-test-dataset.json') {
  const fs = await import('fs/promises');
  await fs.writeFile(filename, JSON.stringify(dataset, null, 2));
  console.log(`✅ Dataset saved to ${filename}`);
  console.log(`   Entities: ${dataset.entities.length}`);
  console.log(`   Relationships: ${dataset.relationships.length}`);
}

// Generate and save if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔧 Generating 1,000 entity test dataset...\n');

  const dataset = generateTestDataset();
  const relationships = generateRelationships(dataset.entities);

  dataset.relationships = relationships;
  dataset.metadata.relationship_count = relationships.length;

  console.log('📊 Dataset Statistics:');
  console.log(`   Total Entities: ${dataset.metadata.total_count}`);
  console.log(`   Total Relationships: ${relationships.length}\n`);

  console.log('📋 Entities by Type:');
  Object.entries(dataset.metadata.counts_by_type).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });

  await saveDataset(dataset);
}
