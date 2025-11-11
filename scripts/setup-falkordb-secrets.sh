#!/bin/bash
#Setup script for FalkorDB Wrangler secrets
# This script helps configure FalkorDB Cloud credentials as Wrangler secrets

echo "🔐 Setting up FalkorDB Cloud secrets for Wrangler..."
echo ""
echo "Make sure you have:"
echo "1. Created a FalkorDB Cloud account at https://app.falkordb.cloud/"
echo "2. Created a database instance"
echo "3. Copied your connection credentials"
echo ""
echo "This will prompt you for each credential securely."
echo ""

# Set secrets using wrangler
echo "Setting FALKORDB_HOST..."
npx wrangler secret put FALKORDB_HOST

echo "Setting FALKORDB_PORT..."
npx wrangler secret put FALKORDB_PORT

echo "Setting FALKORDB_USER..."
npx wrangler secret put FALKORDB_USER

echo "Setting FALKORDB_PASSWORD..."
npx wrangler secret put FALKORDB_PASSWORD

echo ""
echo "✅ FalkorDB secrets configured!"
echo "Verify with: npx wrangler secret list"
