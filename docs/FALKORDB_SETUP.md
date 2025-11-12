# FalkorDB Setup Guide

**Last Updated**: 2025-11-12

---

## ⚠️ IMPORTANT: Current Development Approach

**GraphMind now uses Docker localhost for development (NOT FalkorDB Cloud).**

### Recommended Setup by Environment:

- **Development** (CURRENT): Self-hosted Docker on localhost:6380
  - ✅ Sub-millisecond performance (<1ms connection, 0.32ms node creation)
  - ✅ Zero cost, no API limits
  - ✅ See [FalkorDB Deployment Options](PRD/technical/falkordb-deployment.md) for setup

- **Production** (TBD): Flexible deployment options
  - Option A: VPS self-hosted + REST API wrapper (~$15-30/mo)
  - Option B: FalkorDB Cloud Starter/Pro (~$20-55/mo)
  - See [FalkorDB Deployment Options](PRD/technical/falkordb-deployment.md) for comparison

**This document below covers FalkorDB Cloud setup as an OPTIONAL alternative approach.**

For the **recommended Docker localhost setup**, see:
- [FalkorDB Deployment Options](PRD/technical/falkordb-deployment.md) - Complete architecture guide
- [CLAUDE.md](../CLAUDE.md) - Quick Docker setup instructions

---

# FalkorDB Cloud Setup (Optional Alternative)

This section covers FalkorDB Cloud setup as an alternative to Docker localhost.

**Note**: FalkorDB Cloud FREE tier has 8.4-second connection times which blocked development. We migrated to Docker localhost for 25,000x performance improvement. FalkorDB Cloud Starter tier ($15/mo) may be viable for production.

## ✅ Connection Status: FULLY TESTED & WORKING (Cloud)

**All FalkorDB Cloud connections have been comprehensively tested and verified:**
- ✅ **Python Library** (`falkordb-py 1.2.0`) - All 20 tests passing - **RECOMMENDED**
- ✅ **Redis Protocol** (`redis-cli`) - Fully functional
- ❌ **REST API** - NOT available on cloud instances (see explanation below)

**Performance Verified:**
- Sub-millisecond query execution (< 1ms)
- Fast node creation (0.582ms)
- Fast relationship creation (0.791ms)
- Index creation in 0.235ms

**Test Coverage:**
- Basic connection & authentication ✅
- Graph CRUD operations ✅
- Node & relationship operations ✅
- Complex queries & aggregations ✅
- Indexes & schema introspection ✅
- Query profiling & optimization ✅
- Path finding & pattern matching ✅

## Prerequisites

- Cloudflare account with Workers enabled
- GraphMind project cloned locally
- Node.js v18+ installed

## Step 1: Create FalkorDB Cloud Account

1. Go to [https://app.falkordb.cloud/](https://app.falkordb.cloud/)
2. Sign up with your email or GitHub account
3. Verify your email address

## Step 2: Create Database Instance

### For Local Development (Free Tier)

1. Click **"Create New Database"** in the FalkorDB Cloud dashboard
2. Choose **Free Tier**:
   - 1 GB storage
   - 100 MB RAM
   - No credit card required
   - Perfect for local development and testing
3. Select region: **US East (recommended)** or closest to you
4. Name your database: `graphmind-dev`
5. Click **"Create Database"**

### For Production (Starter Tier - $15/month)

1. Click **"Create New Database"** in the FalkorDB Cloud dashboard
2. Choose **Starter Tier**:
   - 10 GB storage
   - 1 GB RAM
   - 99.9% uptime SLA
   - Automatic backups
3. Select region: **US East** (or closest to your users)
4. Name your database: `graphmind-prod`
5. Click **"Create Database"**
6. Add payment method

## Step 3: Get Connection Credentials

After database creation (takes ~2-3 minutes):

1. Click on your database name in the dashboard
2. Go to the **"Connection"** tab
3. Copy the following credentials:
   - **Host**: e.g., `r-6jissuruar.instance-z170clshh.hc-8zs5aeo3a.us-east1.gcp.f2e0a955bb84.cloud`
   - **Port**: e.g., `55878`
   - **Username**: e.g., `falkorvoiceflarecat`
   - **Password**: (click "Show" button, then copy)

## Step 4: Configure Local Environment

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Edit `.env` and add your FalkorDB credentials:

```env
# FalkorDB Cloud Configuration
FALKORDB_HOST=r-6jissuruar.instance-z170clshh.hc-8zs5aeo3a.us-east1.gcp.f2e0a955bb84.cloud
FALKORDB_PORT=55878
FALKORDB_USER=falkorvoiceflarecat
FALKORDB_PASSWORD=cEkTQ6sscPWv
```

3. Save the file

**Important**: Never commit `.env` to git! It's in `.gitignore` for security.

## Step 5: Test Connection Locally

1. Start the development server:

```bash
npx wrangler dev
```

2. Test the health check endpoint:

```bash
curl http://localhost:8787/api/health/falkordb
```

Expected response:

```json
{
  "status": "healthy",
  "latency_ms": 5,
  "timestamp": "2025-11-11T06:41:19.305Z",
  "pool": {
    "size": 1,
    "available": 1
  }
}
```

If you see `"status": "healthy"`, your connection is working! 🎉

## Step 6: Configure Production Secrets

For production deployment, use Wrangler secrets instead of `.env`:

```bash
# Set FalkorDB credentials as Wrangler secrets
npx wrangler secret put FALKORDB_HOST
# Paste: r-6jissuruar.instance-z170clshh.hc-8zs5aeo3a.us-east1.gcp.f2e0a955bb84.cloud

npx wrangler secret put FALKORDB_PORT
# Paste: 55878

npx wrangler secret put FALKORDB_USER
# Paste: falkorvoiceflarecat

npx wrangler secret put FALKORDB_PASSWORD
# Paste: cEkTQ6sscPWv
```

Secrets are encrypted at rest and never exposed in logs.

## Step 7: Deploy to Production

1. Deploy Workers with Durable Objects:

```bash
npx wrangler deploy
```

2. Test production health check:

```bash
curl https://graphmind-api.workers.dev/api/health/falkordb
```

## Troubleshooting

### Connection Timeout

**Error**: `"status": "down", "details": "Connection timeout after 5000ms"`

**Solutions**:
1. Check firewall rules (FalkorDB Cloud should allow all IPs)
2. Verify host and port are correct (no typos)
3. Check FalkorDB Cloud dashboard - database must be "Running" status
4. Try from different network (some corporate networks block non-standard ports)

### Authentication Failure

**Error**: `"status": "down", "details": "Authentication failed"`

**Solutions**:
1. Verify username and password are correct (copy-paste from dashboard)
2. Check for extra spaces or newlines in credentials
3. Regenerate password in FalkorDB Cloud dashboard if needed

### Database Unreachable

**Error**: `"status": "down", "details": "Graph database unavailable"`

**Solutions**:
1. Check FalkorDB Cloud dashboard - database status should be "Running"
2. If database is "Stopped", click "Start Database"
3. Free tier databases may auto-sleep after inactivity - wait 30s for wake-up
4. Check FalkorDB Cloud status page for outages

### Invalid Credentials in .env

**Error**: `Missing required FalkorDB credentials`

**Solutions**:
1. Ensure all four variables are set in `.env`:
   - `FALKORDB_HOST`
   - `FALKORDB_PORT`
   - `FALKORDB_USER`
   - `FALKORDB_PASSWORD`
2. Check for typos in variable names
3. Restart `wrangler dev` after editing `.env`

## Next Steps

After successful connection:

1. Test namespace provisioning:

```bash
curl -X POST http://localhost:8787/api/graph/init \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

2. Verify your user's graph was created in FalkorDB Cloud dashboard
3. Continue with Phase 2 development (Entity Extraction)

## Understanding FalkorDB Access Methods

FalkorDB supports multiple access methods depending on how you deploy it. It's critical to understand which methods are available for FalkorDB Cloud vs self-hosted installations.

### ⚠️ CRITICAL: FalkorDB Cloud API Access

**FalkorDB Cloud managed instances do NOT have a REST API.**

When the FalkorDB team says "use the cloud API," they mean:
- ✅ **Use the Redis RESP protocol** (this IS the cloud API)
- ✅ **Use the FalkorDB Python/JS client libraries** (which connect via Redis protocol)
- ✅ **Use the GraphRAG SDK** (which connects via Redis protocol)

**The "REST API" confusion:**
The REST API documented at `browser.falkordb.com/docs` is specifically for the **FalkorDB Browser** application (a Next.js web UI), NOT for FalkorDB Cloud managed instances. This REST API is only available when self-hosting the Browser application.

### ✅ FalkorDB Cloud Access (What GraphMind Uses)

**Available on FalkorDB Cloud:**
- ✅ **Redis RESP Protocol** - Direct database access (port 55878 in our case) - **THIS IS THE API**
- ✅ **Python Client Library** (`falkordb-py`) - Connects via Redis protocol
- ✅ **JavaScript Client Library** - Connects via Redis protocol
- ✅ **GraphRAG SDK** - High-level Python SDK for RAG applications
- ✅ **Web UI** - Access via app.falkordb.cloud dashboard (hosted Browser instance)

**NOT Available on FalkorDB Cloud:**
- ❌ **Browser REST API** - NOT exposed on cloud instances (only for self-hosted)
- ❌ **HTTP/HTTPS API endpoints** - Cloud instances only support Redis protocol
- ❌ **Port 3000, 80, or 443 access** - Only port 55878 (Redis) is open

### Self-Hosted FalkorDB (Optional - Advanced Users)

If you self-host FalkorDB, you get additional options:
- ✅ All cloud features above
- ✅ **Browser REST API** - Available when running FalkorDB Browser locally (port 3000)
- ✅ **Bolt Protocol** - Neo4j-compatible protocol
- ✅ **Custom configurations** - Full control over settings

**To self-host with Browser REST API:**
1. Run FalkorDB Browser: `docker run -p 3000:3000 falkordb/falkordb-browser`
2. Configure it to connect to your FalkorDB Cloud instance
3. Access REST API at `http://localhost:3000/api`

**Official Browser Documentation**: [https://browser.falkordb.com/docs](https://browser.falkordb.com/docs)

### ✅ RECOMMENDED: Python Client Library for GraphMind

For GraphMind, use the **FalkorDB Python library** (`falkordb-py`) which connects via Redis protocol. This is the official, fully-supported method for FalkorDB Cloud.

## Python Library Connection (RECOMMENDED)

### Installation

```bash
# Create virtual environment
python3 -m venv .venv

# Install FalkorDB library
.venv/bin/pip install falkordb python-dotenv
```

### Basic Connection

```python
from falkordb import FalkorDB
import os
from dotenv import load_dotenv

load_dotenv()

# Connect to FalkorDB Cloud
db = FalkorDB(
    host=os.getenv('FALKORDB_HOST'),
    port=int(os.getenv('FALKORDB_PORT')),
    username=os.getenv('FALKORDB_USER'),
    password=os.getenv('FALKORDB_PASSWORD')
)

# List all graphs
graphs = db.list_graphs()
print(f"Existing graphs: {graphs}")

# Select/create a graph
graph = db.select_graph('my-knowledge-graph')

# Create nodes
result = graph.query("""
    CREATE
        (alice:Person {name: 'Alice', age: 30}),
        (bob:Person {name: 'Bob', age: 25}),
        (project:Project {name: 'GraphMind'})
    RETURN alice, bob, project
""")

print(f"Created {result.nodes_created} nodes in {result.run_time_ms}ms")

# Query data
result = graph.query("MATCH (p:Person) RETURN p.name, p.age")
for row in result.result_set:
    print(f"{row[0]}, age {row[1]}")

# Delete graph when done
db.connection.execute_command('GRAPH.DELETE', 'my-knowledge-graph')
```

### Comprehensive Test Suite

A full test suite is available at `tests/test_falkordb_connection.py` that validates:

✅ **20 Tests - All Passing:**
1. Basic connection & authentication
2. List existing graphs
3. Create test graph
4. Create nodes (5 nodes, 3 labels, 14 properties)
5. Create relationships (5 relationships with properties)
6. Query all nodes
7. Query with filtering (WHERE clauses)
8. Query relationships (pattern matching)
9. Aggregation queries (COUNT, GROUP BY)
10. Create indexes (on Person.name)
11. List all indexes
12. Get graph schema (labels, relationships, properties)
13. Explain query execution plan
14. Profile query performance
15. Read-only queries (GRAPH.RO_QUERY)
16. Path finding (variable-length patterns)
17. Update node properties (SET)
18. Delete nodes (DETACH DELETE)
19. Cleanup - delete test graph
20. Verify cleanup

**Performance Results:**
- All queries: **< 1ms** execution time
- Node creation: **0.582ms**
- Relationship creation: **0.791ms**
- Complex queries: **0.536ms**
- Index creation: **0.235ms**

Run the test suite:
```bash
.venv/bin/python tests/test_falkordb_connection.py
```

## Testing FalkorDB Cloud via Redis Protocol

### Connection Details

Your FalkorDB Cloud instance uses the Redis RESP protocol:

```bash
Host: r-6jissuruar.instance-z170clshh.hc-8zs5aeo3a.us-east1.gcp.f2e0a955bb84.cloud
Port: 55878
Protocol: Redis RESP
Authentication: Username + Password
```

### Using redis-cli

**Installation** (if not already installed):
```bash
sudo apt-get install redis-tools  # Ubuntu/Debian
brew install redis                # macOS
```

**Basic Connection Test**:
```bash
redis-cli -h r-6jissuruar.instance-z170clshh.hc-8zs5aeo3a.us-east1.gcp.f2e0a955bb84.cloud \
  -p 55878 \
  --no-auth-warning \
  AUTH falkorvoiceflarecat cEkTQ6sscPWv
```

Expected response: `OK`

### Interactive Session

Start an interactive redis-cli session:

```bash
redis-cli -h r-6jissuruar.instance-z170clshh.hc-8zs5aeo3a.us-east1.gcp.f2e0a955bb84.cloud \
  -p 55878 \
  --no-auth-warning

# Then authenticate:
> AUTH falkorvoiceflarecat cEkTQ6sscPWv
OK
```

### Authentication

FalkorDB Cloud requires username/password authentication via the AUTH command:

```bash
AUTH <username> <password>
```

**Note**: Unlike standard Redis which uses only a password, FalkorDB uses ACL-style authentication with both username and password.

### Available FalkorDB Commands

FalkorDB provides graph database commands via the Redis protocol. All commands follow the format: `GRAPH.<COMMAND> <graphname> [arguments]`

#### Core Graph Commands

| Command | Description | Example |
|---------|-------------|---------|
| `GRAPH.QUERY` | Execute Cypher query | `GRAPH.QUERY mygraph "MATCH (n) RETURN n"` |
| `GRAPH.RO_QUERY` | Execute read-only Cypher query | `GRAPH.RO_QUERY mygraph "MATCH (n) RETURN n"` |
| `GRAPH.LIST` | List all graphs | `GRAPH.LIST` |
| `GRAPH.DELETE` | Delete a graph | `GRAPH.DELETE mygraph` |
| `GRAPH.EXPLAIN` | Get query execution plan | `GRAPH.EXPLAIN mygraph "MATCH (n) RETURN n"` |
| `GRAPH.PROFILE` | Profile query with timing | `GRAPH.PROFILE mygraph "MATCH (n) RETURN n"` |
| `GRAPH.CONFIG GET` | Get configuration | `GRAPH.CONFIG GET "*"` |
| `GRAPH.CONFIG SET` | Set configuration | `GRAPH.CONFIG SET TIMEOUT 5000` |

#### Database Information Commands

| Command | Description | Example |
|---------|-------------|---------|
| `DBSIZE` | Get number of keys | `DBSIZE` |
| `INFO` | Get server information | `INFO server` |

#### Cypher Procedures (via GRAPH.QUERY)

| Procedure | Description | Example |
|-----------|-------------|---------|
| `CALL db.labels()` | List all node labels | `GRAPH.QUERY mygraph "CALL db.labels()"` |
| `CALL db.relationshipTypes()` | List relationship types | `GRAPH.QUERY mygraph "CALL db.relationshipTypes()"` |
| `CALL db.propertyKeys()` | List all property keys | `GRAPH.QUERY mygraph "CALL db.propertyKeys()"` |
| `CALL db.indexes()` | List all indexes | `GRAPH.QUERY mygraph "CALL db.indexes()"` |

### Common FalkorDB Operations via redis-cli

#### Create a Graph with Nodes and Relationships

```bash
# Create nodes
redis-cli -h <host> -p <port> --no-auth-warning \
  GRAPH.QUERY my-knowledge-graph \
  "CREATE (:Person {name: 'Alice', age: 30}), (:Person {name: 'Bob', age: 25}), (:Project {name: 'GraphMind', status: 'active'})"

# Create relationships
redis-cli -h <host> -p <port> --no-auth-warning \
  GRAPH.QUERY my-knowledge-graph \
  "MATCH (p:Person {name: 'Alice'}), (proj:Project {name: 'GraphMind'}) CREATE (p)-[:WORKS_ON {role: 'Lead Developer'}]->(proj)"
```

Expected response:
```
Labels added: 2
Nodes created: 3
Properties set: 6
Cached execution: 0
Query internal execution time: 0.385 milliseconds
```

#### Query All Nodes

```bash
redis-cli -h <host> -p <port> --no-auth-warning \
  GRAPH.QUERY my-knowledge-graph \
  "MATCH (n) RETURN n"
```

#### Query with Filtering and Aggregation

```bash
# Find people working on projects
redis-cli -h <host> -p <port> --no-auth-warning \
  GRAPH.QUERY my-knowledge-graph \
  "MATCH (p:Person)-[r:WORKS_ON]->(proj:Project) RETURN p.name, r.role, proj.name"

# Count contributors per project
redis-cli -h <host> -p <port> --no-auth-warning \
  GRAPH.QUERY my-knowledge-graph \
  "MATCH (p:Person)-[:WORKS_ON]->(proj) WITH proj, COUNT(p) as contributors RETURN proj.name, contributors"
```

#### Get Graph Schema Information

```bash
# List all node labels
redis-cli -h <host> -p <port> --no-auth-warning \
  GRAPH.QUERY my-knowledge-graph "CALL db.labels()"

# List relationship types
redis-cli -h <host> -p <port> --no-auth-warning \
  GRAPH.QUERY my-knowledge-graph "CALL db.relationshipTypes()"

# List all property keys
redis-cli -h <host> -p <port> --no-auth-warning \
  GRAPH.QUERY my-knowledge-graph "CALL db.propertyKeys()"
```

Response example:
```
label
Person
Project

relationshipType
WORKS_ON

propertyKey
name
age
status
role
```

#### Create Index for Performance

```bash
# Create index on Person.name
redis-cli -h <host> -p <port> --no-auth-warning \
  GRAPH.QUERY my-knowledge-graph \
  "CREATE INDEX FOR (p:Person) ON (p.name)"

# View all indexes
redis-cli -h <host> -p <port> --no-auth-warning \
  GRAPH.QUERY my-knowledge-graph "CALL db.indexes()"
```

Response:
```
Indices created: 1
Query internal execution time: 0.284 milliseconds
```

#### Explain and Profile Queries

```bash
# Get execution plan
redis-cli -h <host> -p <port> --no-auth-warning \
  GRAPH.EXPLAIN my-knowledge-graph \
  "MATCH (p:Person)-[r:WORKS_ON]->(proj:Project) RETURN p.name, r.role, proj.name"

# Profile with timing
redis-cli -h <host> -p <port> --no-auth-warning \
  GRAPH.PROFILE my-knowledge-graph \
  "MATCH (p:Person)-[r:WORKS_ON]->(proj:Project) RETURN p.name, r.role, proj.name"
```

Example execution plan:
```
Results
    Project
        Conditional Traverse | (proj)-[r:WORKS_ON]->(p:Person)
            Node By Label Scan | (proj:Project)
```

#### List and Delete Graphs

```bash
# List all graphs
redis-cli -h <host> -p <port> --no-auth-warning GRAPH.LIST

# Delete a graph
redis-cli -h <host> -p <port> --no-auth-warning \
  GRAPH.DELETE my-knowledge-graph
```

### Testing FalkorDB from GraphMind

You can test FalkorDB via Redis protocol in your GraphMind development environment:

```bash
# Create a test script
cat > test-falkordb-redis.sh <<'EOF'
#!/bin/bash

# FalkorDB credentials from .env
source .env

HOST="${FALKORDB_HOST}"
PORT="${FALKORDB_PORT}"
USER="${FALKORDB_USER}"
PASS="${FALKORDB_PASSWORD}"

echo "=== Testing FalkorDB via Redis Protocol ==="
echo ""

# Create commands file
cat > /tmp/falkordb-test-commands.txt <<'COMMANDS'
AUTH ${USER} ${PASS}
INFO server
GRAPH.LIST
GRAPH.CONFIG GET "*"
GRAPH.QUERY test-connection "CREATE (:Test {timestamp: '$(date -u +%Y-%m-%dT%H:%M:%SZ)'})"
GRAPH.QUERY test-connection "MATCH (n:Test) RETURN n"
GRAPH.DELETE test-connection
COMMANDS

# Replace variables and run
eval "cat <<COMMANDS
$(cat /tmp/falkordb-test-commands.txt)
COMMANDS" | redis-cli -h ${HOST} -p ${PORT} --no-auth-warning

echo -e "\nDone!"
EOF

chmod +x test-falkordb-redis.sh
./test-falkordb-redis.sh
```

### FalkorDB Configuration Options

Based on testing, your FalkorDB Cloud instance has the following configuration:

| Config Key | Value | Description |
|------------|-------|-------------|
| `CACHE_SIZE` | 25 | Query cache size |
| `OMP_THREAD_COUNT` | 2 | OpenMP thread count |
| `THREAD_COUNT` | 2 | Worker thread count |
| `RESULTSET_SIZE` | 10000 | Max rows per query result |
| `QUERY_MEM_CAPACITY` | 52428800 | Max memory per query (50MB) |
| `MAX_QUEUED_QUERIES` | 50 | Max concurrent queries |
| `NODE_CREATION_BUFFER` | 16384 | Node creation buffer size |
| `TIMEOUT` | 0 | Query timeout (0 = no timeout) |
| `ASYNC_DELETE` | 1 | Async graph deletion enabled |

### Redis Protocol Best Practices

1. **Authentication**
   - Always use `AUTH username password` before any commands
   - Use `--no-auth-warning` flag with redis-cli to suppress warnings
   - Never log credentials in production

2. **Query Optimization**
   - Use `LIMIT` in Cypher queries to prevent large result sets
   - Create indexes on frequently queried properties
   - Use `GRAPH.PROFILE` to identify slow operations
   - Use `GRAPH.RO_QUERY` for read-only queries (allows replica reads)

3. **Error Handling**
   - Check for "AUTH failed" errors (wrong credentials)
   - Handle "TIMEOUT" errors (query taking too long)
   - Implement retry logic for transient connection failures
   - Use exponential backoff for retries

4. **Performance**
   - All tested queries executed in < 1ms
   - Cached queries are even faster
   - Index creation improves lookup performance significantly
   - Profile queries to optimize execution plans

5. **Security**
   - Use the Redis protocol (port 55878), NOT HTTP/HTTPS
   - Validate all Cypher queries to prevent injection
   - Use parameterized queries when possible
   - Rotate passwords regularly (every 90 days recommended)

## Resource Monitoring

### Free Tier Limits

- **Storage**: 1 GB total
- **RAM**: 100 MB
- **Queries**: Unlimited
- **Bandwidth**: Unlimited
- **Uptime**: Best effort (may sleep after inactivity)

Monitor usage in FalkorDB Cloud dashboard under "Metrics" tab.

### Upgrade to Starter Tier

When to upgrade:
- You hit storage limit (>1 GB of graph data)
- You need guaranteed uptime (production)
- You need automatic backups
- You want faster query performance (more RAM)

Upgrade process:
1. Click "Upgrade" in FalkorDB Cloud dashboard
2. Choose Starter tier ($15/month)
3. Add payment method
4. Click "Confirm Upgrade"
5. No data loss - existing data is preserved
6. Update credentials if host/port changes (usually doesn't)

## Security Best Practices

1. **Never commit credentials to git**
   - Always use `.env` (local) or Wrangler secrets (production)
   - Double-check `.gitignore` includes `.env`

2. **Rotate passwords regularly**
   - Every 90 days recommended
   - After team member leaves
   - If credentials accidentally exposed

3. **Use separate databases for dev/prod**
   - Free tier for local development
   - Starter/Pro tier for production
   - Prevents accidental data corruption

4. **Monitor access logs**
   - Check FalkorDB Cloud "Activity" tab
   - Watch for unexpected connections
   - Set up alerts for failed auth attempts

## Getting Help

- **FalkorDB Docs**: https://docs.falkordb.com/
- **FalkorDB GitHub**: https://github.com/FalkorDB/FalkorDB
- **GraphMind Issues**: https://github.com/yourusername/graphmind/issues
- **FalkorDB Discord**: Join for community support

## Quick Reference

### Connection Details

```bash
Host: r-6jissuruar.instance-z170clshh.hc-8zs5aeo3a.us-east1.gcp.f2e0a955bb84.cloud
Port: 55878
Protocol: Redis RESP
Library: falkordb-py 1.2.0
```

### Python Quick Start (RECOMMENDED)

```python
from falkordb import FalkorDB
import os

# Connect
db = FalkorDB(
    host=os.getenv('FALKORDB_HOST'),
    port=int(os.getenv('FALKORDB_PORT')),
    username=os.getenv('FALKORDB_USER'),
    password=os.getenv('FALKORDB_PASSWORD')
)

# Select graph
graph = db.select_graph('mygraph')

# Create
graph.query("CREATE (n:Person {name: 'Alice'})")

# Query
result = graph.query("MATCH (n) RETURN n LIMIT 10")

# Delete graph
db.connection.execute_command('GRAPH.DELETE', 'mygraph')
```

### redis-cli Commands

**Connect and Authenticate**:
```bash
redis-cli -h <host> -p <port> --no-auth-warning
AUTH <username> <password>
```

**List Graphs**:
```bash
GRAPH.LIST
```

**Create Graph**:
```bash
GRAPH.QUERY mygraph "CREATE (:Person {name: 'Alice'})"
```

**Query Graph**:
```bash
GRAPH.QUERY mygraph "MATCH (n) RETURN n LIMIT 10"
```

**Get Schema Info**:
```bash
GRAPH.QUERY mygraph "CALL db.labels()"
GRAPH.QUERY mygraph "CALL db.relationshipTypes()"
GRAPH.QUERY mygraph "CALL db.propertyKeys()"
```

**Create Index**:
```bash
GRAPH.QUERY mygraph "CREATE INDEX FOR (n:Person) ON (n.name)"
```

**Profile Query**:
```bash
GRAPH.PROFILE mygraph "MATCH (p:Person) RETURN p"
```

**Delete Graph**:
```bash
GRAPH.DELETE mygraph
```

### Wrangler Commands

**Deploy Workers**:
```bash
npx wrangler deploy
```

**View Secrets**:
```bash
npx wrangler secret list
```

**Set Secret**:
```bash
npx wrangler secret put FALKORDB_PASSWORD
```

**Delete Secret**:
```bash
npx wrangler secret delete FALKORDB_PASSWORD
```

### Health Check (via Workers)

```bash
curl http://localhost:8787/api/health/falkordb
```

---

**Last Updated**: 2025-11-12
**GraphMind Version**: 0.1.0
**FalkorDB Version**: Redis 8.2.2 (FalkorDB module)
**Tested Library**: falkordb-py 1.2.0 (✅ All 20 tests passing)
