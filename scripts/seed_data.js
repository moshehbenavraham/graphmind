
import { createClient } from 'redis';

const client = createClient({
    url: 'redis://localhost:6380'
});

async function seed() {
    await client.connect();

    const graph = 'user_test_2'; // Using a fresh test namespace

    console.log(`Seeding graph: ${graph}`);

    // Clear existing
    try {
        await client.sendCommand(['GRAPH.DELETE', graph]);
    } catch (e) {
        // Ignore if graph doesn't exist
    }

    // Create data
    // Sarah works on GraphMind
    // GraphMind uses FalkorDB
    const query = `
    CREATE (sarah:Person {name: 'Sarah', role: 'Developer'})
    CREATE (graphmind:Project {name: 'GraphMind', description: 'Voice-first knowledge assistant'})
    CREATE (falkordb:Technology {name: 'FalkorDB'})
    CREATE (sarah)-[:WORKS_ON]->(graphmind)
    CREATE (graphmind)-[:USES_TECHNOLOGY]->(falkordb)
    RETURN sarah, graphmind, falkordb
  `;

    // Step 1: Create people, projects, and technologies
    const query1 = `
    CREATE
      (p1:Person {name: "Alice Johnson", role: "CEO", email: "alice@example.com"}),
      (p2:Person {name: "Bob Smith", role: "CTO", email: "bob@example.com"}),
      (p3:Person {name: "Carol White", role: "Designer", email: "carol@example.com"}),
      (proj1:Project {name: "GraphMind", status: "active", priority: "high"}),
      (proj2:Project {name: "Mobile App", status: "planning", priority: "medium"}),
      (tech1:Technology {name: "Cloudflare Workers", category: "infrastructure"}),
      (tech2:Technology {name: "FalkorDB", category: "database"}),
      (tech3:Technology {name: "React", category: "frontend"}),
      (p1)-[:LEADS]->(proj1),
      (p2)-[:WORKS_ON]->(proj1),
      (p3)-[:WORKS_ON]->(proj1),
      (proj1)-[:USES]->(tech1),
      (proj1)-[:USES]->(tech2),
      (proj1)-[:USES]->(tech3),
      (p1)-[:MANAGES]->(p2),
      (p1)-[:MANAGES]->(p3)
    RETURN count(*) as count
  `;

    console.log('Running Query 1...');
    await client.sendCommand(['GRAPH.QUERY', graph, query1]);

    // Step 2: Add meetings and topics
    const query2 = `
    MATCH
      (alice:Person {name: "Alice Johnson"}),
      (bob:Person {name: "Bob Smith"}),
      (carol:Person {name: "Carol White"}),
      (gm:Project {name: "GraphMind"})
    CREATE
      (m1:Meeting {title: "GraphMind Kickoff", date: "2025-01-10", duration: 60}),
      (m2:Meeting {title: "Design Review", date: "2025-01-15", duration: 45}),
      (topic1:Topic {name: "Voice AI", category: "feature"}),
      (topic2:Topic {name: "Knowledge Graph", category: "architecture"}),
      (topic3:Topic {name: "User Interface", category: "design"}),
      (alice)-[:ATTENDED]->(m1),
      (bob)-[:ATTENDED]->(m1),
      (carol)-[:ATTENDED]->(m1),
      (alice)-[:ATTENDED]->(m2),
      (carol)-[:ATTENDED]->(m2),
      (m1)-[:DISCUSSED]->(topic1),
      (m1)-[:DISCUSSED]->(topic2),
      (m2)-[:DISCUSSED]->(topic3),
      (gm)-[:RELATES_TO]->(topic1),
      (gm)-[:RELATES_TO]->(topic2),
      (gm)-[:RELATES_TO]->(topic3)
    RETURN count(*) as count
  `;

    console.log('Running Query 2...');
    await client.sendCommand(['GRAPH.QUERY', graph, query2]);

    // Step 3: Add tasks and decisions
    const query3 = `
    MATCH
      (alice:Person {name: "Alice Johnson"}),
      (bob:Person {name: "Bob Smith"}),
      (carol:Person {name: "Carol White"}),
      (gm:Project {name: "GraphMind"})
    CREATE
      (task1:Task {title: "Implement voice transcription", status: "completed", priority: "high"}),
      (task2:Task {title: "Design dashboard UI", status: "in_progress", priority: "high"}),
      (task3:Task {title: "Setup database", status: "completed", priority: "high"}),
      (dec1:Decision {title: "Use FalkorDB for knowledge graph", date: "2025-01-05", rationale: "Better performance for graph queries"}),
      (dec2:Decision {title: "Deploy on Cloudflare Workers", date: "2025-01-08", rationale: "Global edge network, low latency"}),
      (bob)-[:ASSIGNED_TO]->(task1),
      (carol)-[:ASSIGNED_TO]->(task2),
      (bob)-[:ASSIGNED_TO]->(task3),
      (gm)-[:HAS_TASK]->(task1),
      (gm)-[:HAS_TASK]->(task2),
      (gm)-[:HAS_TASK]->(task3),
      (alice)-[:MADE]->(dec1),
      (alice)-[:MADE]->(dec2),
      (gm)-[:HAS_DECISION]->(dec1),
      (gm)-[:HAS_DECISION]->(dec2)
    RETURN count(*) as count
  `;

    console.log('Running Query 3...');
    await client.sendCommand(['GRAPH.QUERY', graph, query3]);


    console.log('Seed complete!');
    console.log('Created: Sarah -[WORKS_ON]-> GraphMind -[USES_TECHNOLOGY]-> FalkorDB');

    await client.disconnect();
}

seed().catch(console.error);
