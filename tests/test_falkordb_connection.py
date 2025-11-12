#!/usr/bin/env python3
"""
Comprehensive FalkorDB Cloud Connection Test
Tests all major operations with the FalkorDB Python library.
"""

import os
import sys
from datetime import datetime
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from falkordb import FalkorDB

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_test(name):
    print(f"\n{Colors.BLUE}{Colors.BOLD}Testing: {name}{Colors.END}")

def print_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.END}")

def print_error(msg):
    print(f"{Colors.RED}✗ {msg}{Colors.END}")

def print_info(msg):
    print(f"{Colors.YELLOW}ℹ {msg}{Colors.END}")

def main():
    print(f"{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}FalkorDB Cloud Connection Test Suite{Colors.END}")
    print(f"{Colors.BOLD}{'='*60}{Colors.END}")

    # Get connection details from environment
    host = os.getenv('FALKORDB_HOST')
    port = int(os.getenv('FALKORDB_PORT', '55878'))
    username = os.getenv('FALKORDB_USER')
    password = os.getenv('FALKORDB_PASSWORD')

    print_info(f"Host: {host}")
    print_info(f"Port: {port}")
    print_info(f"Username: {username}")
    print_info(f"Connection protocol: Redis RESP")

    # Test 1: Basic Connection
    print_test("1. Basic Connection & Authentication")
    try:
        db = FalkorDB(
            host=host,
            port=port,
            username=username,
            password=password
        )
        print_success("Connection established successfully")
    except Exception as e:
        print_error(f"Connection failed: {e}")
        return 1

    # Test 2: List Existing Graphs
    print_test("2. List Existing Graphs")
    try:
        graphs = db.list_graphs()
        print_success(f"Found {len(graphs)} existing graphs: {graphs}")
    except Exception as e:
        print_error(f"Failed to list graphs: {e}")
        return 1

    # Test 3: Create Test Graph
    graph_name = f"graphmind_connection_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    print_test(f"3. Create Test Graph: {graph_name}")
    try:
        graph = db.select_graph(graph_name)
        print_success(f"Graph '{graph_name}' selected/created")
    except Exception as e:
        print_error(f"Failed to create graph: {e}")
        return 1

    # Test 4: Create Nodes
    print_test("4. Create Nodes")
    try:
        result = graph.query("""
            CREATE
                (alice:Person {name: 'Alice', age: 30, role: 'Engineer'}),
                (bob:Person {name: 'Bob', age: 25, role: 'Designer'}),
                (charlie:Person {name: 'Charlie', age: 35, role: 'Manager'}),
                (graphmind:Project {name: 'GraphMind', status: 'active', year: 2025}),
                (falkordb:Technology {name: 'FalkorDB', type: 'Graph Database'})
            RETURN alice, bob, charlie, graphmind, falkordb
        """)
        print_success(f"Created nodes - Labels added: {result.labels_added}, Nodes created: {result.nodes_created}, Properties set: {result.properties_set}")
        print_info(f"Execution time: {result.run_time_ms:.3f}ms")
    except Exception as e:
        print_error(f"Failed to create nodes: {e}")
        return 1

    # Test 5: Create Relationships
    print_test("5. Create Relationships")
    try:
        result = graph.query("""
            MATCH
                (alice:Person {name: 'Alice'}),
                (bob:Person {name: 'Bob'}),
                (charlie:Person {name: 'Charlie'}),
                (project:Project {name: 'GraphMind'}),
                (tech:Technology {name: 'FalkorDB'})
            CREATE
                (alice)-[:WORKS_ON {since: 2025, role: 'Lead Developer'}]->(project),
                (bob)-[:WORKS_ON {since: 2025, role: 'UI Designer'}]->(project),
                (charlie)-[:MANAGES {since: 2025}]->(project),
                (alice)-[:KNOWS {since: 2024}]->(bob),
                (project)-[:USES {version: '1.2.0'}]->(tech)
            RETURN alice, bob, charlie, project, tech
        """)
        print_success(f"Created relationships - Relationships created: {result.relationships_created}, Properties set: {result.properties_set}")
        print_info(f"Execution time: {result.run_time_ms:.3f}ms")
    except Exception as e:
        print_error(f"Failed to create relationships: {e}")
        return 1

    # Test 6: Query All Nodes
    print_test("6. Query All Nodes")
    try:
        result = graph.query("MATCH (n) RETURN n LIMIT 10")
        print_success(f"Retrieved {len(result.result_set)} nodes")
        for row in result.result_set:
            node = row[0]
            print_info(f"  - {node}")
    except Exception as e:
        print_error(f"Failed to query nodes: {e}")
        return 1

    # Test 7: Query with Filtering
    print_test("7. Query with Filtering (People over 27)")
    try:
        result = graph.query("""
            MATCH (p:Person)
            WHERE p.age > 27
            RETURN p.name, p.age, p.role
            ORDER BY p.age DESC
        """)
        print_success(f"Found {len(result.result_set)} people over 27")
        for row in result.result_set:
            print_info(f"  - {row[0]}, age {row[1]}, {row[2]}")
        print_info(f"Execution time: {result.run_time_ms:.3f}ms")
    except Exception as e:
        print_error(f"Failed to query with filtering: {e}")
        return 1

    # Test 8: Query Relationships
    print_test("8. Query Relationships (Who works on what)")
    try:
        result = graph.query("""
            MATCH (p:Person)-[r:WORKS_ON]->(proj:Project)
            RETURN p.name, r.role, proj.name
        """)
        print_success(f"Found {len(result.result_set)} work relationships")
        for row in result.result_set:
            print_info(f"  - {row[0]} works on {row[2]} as {row[1]}")
        print_info(f"Execution time: {result.run_time_ms:.3f}ms")
    except Exception as e:
        print_error(f"Failed to query relationships: {e}")
        return 1

    # Test 9: Aggregation Query
    print_test("9. Aggregation Query (Count people by role)")
    try:
        result = graph.query("""
            MATCH (p:Person)
            RETURN p.role as role, COUNT(p) as count
            ORDER BY count DESC
        """)
        print_success(f"Found {len(result.result_set)} roles")
        for row in result.result_set:
            print_info(f"  - {row[0]}: {row[1]} people")
    except Exception as e:
        print_error(f"Failed to run aggregation: {e}")
        return 1

    # Test 10: Create Index
    print_test("10. Create Index on Person.name")
    try:
        result = graph.query("CREATE INDEX FOR (p:Person) ON (p.name)")
        print_success(f"Index created - Indices created: {result.indices_created}")
        print_info(f"Execution time: {result.run_time_ms:.3f}ms")
    except Exception as e:
        print_error(f"Failed to create index: {e}")
        return 1

    # Test 11: List Indexes
    print_test("11. List All Indexes")
    try:
        result = graph.query("CALL db.indexes()")
        print_success(f"Found {len(result.result_set)} indexes")
        for row in result.result_set:
            if row[0]:  # label
                print_info(f"  - Label: {row[0]}, Properties: {row[1]}, Status: {row[7]}")
    except Exception as e:
        print_error(f"Failed to list indexes: {e}")
        return 1

    # Test 12: Get Graph Schema
    print_test("12. Get Graph Schema")
    try:
        # Get labels
        labels_result = graph.query("CALL db.labels()")
        labels = [row[0] for row in labels_result.result_set]
        print_success(f"Labels: {labels}")

        # Get relationship types
        rels_result = graph.query("CALL db.relationshipTypes()")
        rels = [row[0] for row in rels_result.result_set]
        print_success(f"Relationship types: {rels}")

        # Get property keys
        props_result = graph.query("CALL db.propertyKeys()")
        props = [row[0] for row in props_result.result_set]
        print_success(f"Property keys: {props}")
    except Exception as e:
        print_error(f"Failed to get schema: {e}")
        return 1

    # Test 13: Explain Query
    print_test("13. Explain Query Execution Plan")
    try:
        result = graph.explain("""
            MATCH (p:Person)-[r:WORKS_ON]->(proj:Project)
            WHERE p.age > 25
            RETURN p.name, proj.name
        """)
        print_success("Query execution plan:")
        for line in result:
            print_info(f"  {line}")
    except Exception as e:
        print_error(f"Failed to explain query: {e}")
        return 1

    # Test 14: Profile Query
    print_test("14. Profile Query Performance")
    try:
        result = graph.profile("""
            MATCH (p:Person)-[r:WORKS_ON]->(proj:Project)
            RETURN p.name, r.role, proj.name
        """)
        print_success("Query profile:")
        for line in result:
            print_info(f"  {line}")
    except Exception as e:
        print_error(f"Failed to profile query: {e}")
        return 1

    # Test 15: Read-Only Query
    print_test("15. Read-Only Query")
    try:
        result = graph.ro_query("""
            MATCH (p:Person)
            RETURN p.name, p.age
            ORDER BY p.age
        """)
        print_success(f"Read-only query returned {len(result.result_set)} rows")
        print_info(f"Execution time: {result.run_time_ms:.3f}ms")
    except Exception as e:
        print_error(f"Failed to run read-only query: {e}")
        return 1

    # Test 16: Path Finding
    print_test("16. Path Finding (Find paths between Alice and technology)")
    try:
        result = graph.query("""
            MATCH path = (alice:Person {name: 'Alice'})-[*]->(tech:Technology)
            RETURN path
            LIMIT 5
        """)
        print_success(f"Found {len(result.result_set)} paths")
        print_info(f"Execution time: {result.run_time_ms:.3f}ms")
    except Exception as e:
        print_error(f"Failed to find paths: {e}")
        return 1

    # Test 17: Update Node Properties
    print_test("17. Update Node Properties")
    try:
        result = graph.query("""
            MATCH (alice:Person {name: 'Alice'})
            SET alice.level = 'Senior', alice.skills = ['Python', 'GraphDB', 'AI']
            RETURN alice
        """)
        print_success(f"Updated properties - Properties set: {result.properties_set}")
        print_info(f"Execution time: {result.run_time_ms:.3f}ms")
    except Exception as e:
        print_error(f"Failed to update properties: {e}")
        return 1

    # Test 18: Delete Specific Nodes
    print_test("18. Delete Specific Node")
    try:
        result = graph.query("""
            MATCH (charlie:Person {name: 'Charlie'})
            DETACH DELETE charlie
        """)
        print_success(f"Deleted node - Nodes deleted: {result.nodes_deleted}, Relationships deleted: {result.relationships_deleted}")
    except Exception as e:
        print_error(f"Failed to delete node: {e}")
        return 1

    # Test 19: Cleanup - Delete Test Graph
    print_test("19. Cleanup - Delete Test Graph")
    try:
        # Use Redis command directly
        result = db.connection.execute_command('GRAPH.DELETE', graph_name)
        print_success(f"Test graph '{graph_name}' deleted successfully: {result}")
    except Exception as e:
        print_error(f"Failed to delete test graph: {e}")
        return 1

    # Test 20: Verify Cleanup
    print_test("20. Verify Cleanup")
    try:
        graphs_after = db.list_graphs()
        if graph_name not in graphs_after:
            print_success(f"Graph successfully removed. Current graphs: {graphs_after}")
        else:
            print_error("Graph still exists after deletion")
    except Exception as e:
        print_error(f"Failed to verify cleanup: {e}")
        return 1

    # Final Summary
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.GREEN}{Colors.BOLD}✓ All Tests Passed!{Colors.END}")
    print(f"{Colors.BOLD}{'='*60}{Colors.END}")
    print_info("FalkorDB Cloud connection is fully functional via Redis protocol")
    print_info("Connection details:")
    print_info(f"  - Protocol: Redis RESP")
    print_info(f"  - Host: {host}")
    print_info(f"  - Port: {port}")
    print_info(f"  - Library: falkordb-py 1.2.0")

    return 0

if __name__ == "__main__":
    sys.exit(main())
