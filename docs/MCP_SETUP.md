# MCP Server Setup for GraphMind

This document describes the Model Context Protocol (MCP) servers configured for the GraphMind project.

## What is MCP?

Model Context Protocol (MCP) is an open standard that connects AI systems with external applications. Cloudflare provides remote MCP servers that integrate with Claude Code and other AI development tools.

## Configured MCP Servers

The following Cloudflare MCP servers are configured for GraphMind development:

### 1. Workers Bindings
**URL:** `https://bindings.mcp.cloudflare.com/mcp`

Build Workers applications with access to:
- D1 (SQLite database)
- KV (key-value storage)
- R2 (object storage)
- Durable Objects (stateful coordination)
- Workers AI models

**Use for:** Database schema design, KV cache patterns, R2 audio storage setup

### 2. Workers Observability
**URL:** `https://observability.mcp.cloudflare.com/mcp`

Debug and monitor Workers applications:
- View application logs
- Analyze performance metrics
- Troubleshoot issues

**Use for:** Debugging voice pipeline, monitoring API endpoints, tracking errors

### 3. Cloudflare Documentation
**URL:** `https://docs.mcp.cloudflare.com/mcp`

Access up-to-date Cloudflare Developer Documentation:
- API references
- SDK documentation
- Best practices

**Use for:** API integration, configuration guidance, feature discovery

### 4. Browser Rendering
**URL:** `https://browser.mcp.cloudflare.com/mcp`

Web content processing:
- Fetch web pages
- Convert HTML to markdown
- Capture screenshots

**Use for:** URL ingestion feature (Phase 4), content extraction, web scraping

### 5. Container Sandbox
**URL:** `https://containers.mcp.cloudflare.com/mcp`

Isolated development environments:
- Test code in sandbox
- Validate implementations
- Experiment safely

**Use for:** Testing entity extraction logic, Cypher query validation, code experiments

### 6. Workers Builds
**URL:** `https://builds.mcp.cloudflare.com/mcp`

Manage deployment insights:
- Build status
- Deployment history
- Build configurations

**Use for:** CI/CD pipeline, deployment monitoring, build troubleshooting

## Setup Instructions

### Automated Setup (Recommended)

For a quick automated setup, run:

```bash
./scripts/setup-mcp.sh
```

This script will:
1. Install Wrangler CLI
2. Authenticate with Cloudflare (opens browser)
3. Add all 6 MCP servers to Claude Code

**For manual setup or if you need more control, follow the steps below.**

---

### Manual Setup

#### Step 1: Install Wrangler (Cloudflare CLI)

**Wrangler** is Cloudflare's official CLI tool for managing Workers, D1, KV, R2, and other services.

```bash
# Install globally
npm install -g wrangler

# Or install as dev dependency in this project
npm install --save-dev wrangler
```

Verify installation:
```bash
wrangler --version
```

#### Step 2: Authenticate with Cloudflare

```bash
# Login to your Cloudflare account
wrangler login
```

This will:
1. Open a browser window automatically
2. Prompt you to log in to your Cloudflare account
3. Ask you to authorize Wrangler
4. Store authentication tokens securely on your machine

**Alternative:** For CI/CD or environments without browser access:
```bash
# Set API token as environment variable
export CLOUDFLARE_API_TOKEN=your-api-token-here
```

To get an API token:
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create a token with "Edit Cloudflare Workers" template
3. Copy the token and set it as the environment variable

#### Step 3: Add MCP Servers to Claude Code

To connect Cloudflare MCP servers to Claude Code:

```bash
# Add Workers Bindings MCP server
claude mcp add --transport http cloudflare-bindings https://bindings.mcp.cloudflare.com/mcp

# Add Observability MCP server
claude mcp add --transport http cloudflare-observability https://observability.mcp.cloudflare.com/mcp

# Add Documentation MCP server
claude mcp add --transport http cloudflare-docs https://docs.mcp.cloudflare.com/mcp

# Add Browser Rendering MCP server
claude mcp add --transport http cloudflare-browser https://browser.mcp.cloudflare.com/mcp

# Add Container MCP server
claude mcp add --transport http cloudflare-container https://containers.mcp.cloudflare.com/mcp

# Add Workers Builds MCP server
claude mcp add --transport http cloudflare-builds https://builds.mcp.cloudflare.com/mcp
```

#### Step 4: Authenticate MCP Servers with OAuth

After adding MCP servers:

1. In Claude Code, type `/mcp` to open the MCP menu
2. Select the Cloudflare MCP server you want to authenticate
3. A browser window will open automatically (or copy the provided URL)
4. Log in to your Cloudflare account if not already logged in
5. Grant permissions to the MCP server
6. Return to Claude Code - authentication is complete!

**Authentication tokens are:**
- Stored securely by Claude Code
- Refreshed automatically when needed
- Can be revoked anytime via `/mcp` > "Clear authentication"

#### Alternative: Using mcp-remote

To use these MCP servers with other MCP clients:

```bash
# Install mcp-remote globally
npm install -g mcp-remote

# Connect to a specific server
npx mcp-remote https://bindings.mcp.cloudflare.com/mcp
```

## Requirements

- Node.js v18+ (for mcp-remote)
- Cloudflare account (free tier works for most features)
- For some features: Cloudflare Workers Paid plan

## Usage Examples

### Query Cloudflare Documentation
Ask Claude Code: "What are the D1 database limits?" - The Documentation MCP server will provide up-to-date information.

### Check Workers Bindings
Ask Claude Code: "Show me examples of D1 batch operations" - The Workers Bindings server will provide code examples.

### Debug Production Issues
Ask Claude Code: "Check the logs for errors in the voice pipeline" - The Observability server will fetch recent logs.

## Additional Resources

- [Cloudflare MCP Documentation](https://developers.cloudflare.com/agents/model-context-protocol/)
- [Cloudflare MCP GitHub](https://github.com/cloudflare/mcp-server-cloudflare)
- [MCP Specification](https://modelcontextprotocol.io/)

## Notes

- MCP servers are remote and require internet connectivity
- Some operations may require specific Cloudflare account permissions
- Rate limits may apply depending on your Cloudflare plan
