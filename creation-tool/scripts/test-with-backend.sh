#!/bin/bash

# Script to run Playwright tests with the Tauri backend test server

set -e

# Cleanup function
cleanup() {
  echo "Cleaning up..."
  if [ ! -z "$TAURI_PID" ]; then
    kill $TAURI_PID 2>/dev/null || true
  fi
  # Also kill any process on port 3001
  lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
}

# Ensure cleanup runs on exit
trap cleanup EXIT

# Kill any existing processes on port 3001
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true

echo "Building Tauri app with test-server feature..."
cd src-tauri
cargo build --features test-server

echo "Starting Tauri app with test server..."
# Run the app in the background
cargo run --features test-server &
TAURI_PID=$!

# Wait for the test server to start
echo "Waiting for test server to start on port 3001..."
timeout=30
elapsed=0
while ! nc -z localhost 3001 2>/dev/null; do
  sleep 1
  elapsed=$((elapsed + 1))
  if [ $elapsed -ge $timeout ]; then
    echo "Timeout waiting for test server"
    exit 1
  fi
done

echo "Test server is ready!"

# Go back to frontend directory
cd ..

# Run Playwright tests
echo "Running Playwright tests..."
npx playwright test "$@"

TEST_EXIT_CODE=$?

exit $TEST_EXIT_CODE
