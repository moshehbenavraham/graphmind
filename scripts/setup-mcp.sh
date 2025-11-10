#!/bin/bash

# GraphMind - MCP Server Setup Script
# This script installs Wrangler CLI and adds Cloudflare MCP servers to Claude Code

set -e

echo "========================================="
echo "GraphMind - MCP Server Setup"
echo "========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed."
    echo "Please install Node.js v18+ from https://nodejs.org/"
    exit 1
fi

echo "Node.js version: $(node --version)"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed."
    exit 1
fi

echo "npm version: $(npm --version)"
echo ""

# Install Wrangler if not already installed
echo "Step 1: Installing Wrangler CLI..."
if command -v wrangler &> /dev/null; then
    echo "Wrangler is already installed: $(wrangler --version)"
else
    npm install -g wrangler
    echo "Wrangler installed successfully!"
fi
echo ""

# Authenticate with Cloudflare
echo "Step 2: Authenticating with Cloudflare..."
echo "This will open a browser window for OAuth authentication."
echo "Please log in and grant permissions to Wrangler."
echo ""
read -p "Press Enter to continue..."

wrangler login

if wrangler whoami &> /dev/null; then
    echo ""
    echo "Authentication successful!"
    wrangler whoami
else
    echo ""
    echo "ERROR: Authentication failed."
    echo "Please try running 'wrangler login' manually."
    exit 1
fi
echo ""

# Add MCP servers to Claude Code
echo "Step 3: Adding Cloudflare MCP servers to Claude Code..."
echo ""

if ! command -v claude &> /dev/null; then
    echo "WARNING: Claude Code CLI not found."
    echo "Please add MCP servers manually using the commands in docs/MCP_SETUP.md"
    echo ""
    echo "Quick reference:"
    echo "  claude mcp add --transport http cloudflare-bindings https://bindings.mcp.cloudflare.com/mcp"
    echo "  claude mcp add --transport http cloudflare-observability https://observability.mcp.cloudflare.com/mcp"
    echo "  claude mcp add --transport http cloudflare-docs https://docs.mcp.cloudflare.com/mcp"
    echo "  claude mcp add --transport http cloudflare-browser https://browser.mcp.cloudflare.com/mcp"
    echo "  claude mcp add --transport http cloudflare-container https://containers.mcp.cloudflare.com/mcp"
    echo "  claude mcp add --transport http cloudflare-builds https://builds.mcp.cloudflare.com/mcp"
else
    echo "Adding MCP servers..."

    claude mcp add --transport http cloudflare-bindings https://bindings.mcp.cloudflare.com/mcp
    echo "  Added: Workers Bindings"

    claude mcp add --transport http cloudflare-observability https://observability.mcp.cloudflare.com/mcp
    echo "  Added: Observability"

    claude mcp add --transport http cloudflare-docs https://docs.mcp.cloudflare.com/mcp
    echo "  Added: Documentation"

    claude mcp add --transport http cloudflare-browser https://browser.mcp.cloudflare.com/mcp
    echo "  Added: Browser Rendering"

    claude mcp add --transport http cloudflare-container https://containers.mcp.cloudflare.com/mcp
    echo "  Added: Container Sandbox"

    claude mcp add --transport http cloudflare-builds https://builds.mcp.cloudflare.com/mcp
    echo "  Added: Workers Builds"

    echo ""
    echo "MCP servers added successfully!"
fi

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. In Claude Code, type /mcp to authenticate with Cloudflare MCP servers"
echo "2. Select each MCP server and grant OAuth permissions"
echo "3. Start building with 'npm run dev'"
echo ""
echo "For more information, see docs/MCP_SETUP.md and docs/SETUP.md"
echo ""
