#!/bin/bash

# Start Backend
echo "Starting Backend..."
cd server
npm run dev &
SERVER_PID=$!

# Start Frontend
echo "Starting Frontend..."
cd ../client
npm run dev &
CLIENT_PID=$!

# Start Electron Agent
# echo "Starting Electron Agent..."
# cd ../electron-agent
# npm run start -- --no-sandbox &
# AGENT_PID=$!

# Handle shutdown
trap "kill $SERVER_PID $CLIENT_PID $AGENT_PID; exit" SIGINT

wait
