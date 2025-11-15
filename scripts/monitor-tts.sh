#!/bin/bash
# TTS Monitoring Script for Feature 010
# Monitors TTS latency and cache performance in production

echo "🔍 GraphMind TTS Monitoring Dashboard"
echo "====================================="
echo ""
echo "📊 Deployment Info:"
echo "  Production URL: https://graphmind-api.apex-web-services-llc-0d4.workers.dev"
echo "  Monitoring Period: 24 hours from deployment"
echo "  Targets: TTS latency <1s (p95), Cache hit rate >60%"
echo ""
echo "🔴 Starting live log monitoring..."
echo "  (Press Ctrl+C to stop)"
echo ""
echo "Looking for:"
echo "  - [TTS] synthesis events"
echo "  - [AudioCache] cache hit/miss events"
echo "  - Audio streaming metrics"
echo "  - Performance timings"
echo ""
echo "---"
echo ""

# Tail logs and filter for TTS-related events
npx wrangler tail graphmind-api --format pretty | grep --line-buffered -E "TTS|AudioCache|audio|synthesis|cache|playback" | while read line; do
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] $line"
done
