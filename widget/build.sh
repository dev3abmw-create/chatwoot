#!/bin/bash

echo "🔨 Building Chatwoot Custom Widget..."
echo ""

# Build SDK
echo "📦 Step 1: Building SDK..."
BUILD_MODE=library pnpm run build:sdk
if [ $? -eq 0 ]; then
  echo "✅ SDK built successfully!"
else
  echo "❌ SDK build failed!"
  exit 1
fi

echo ""

# Build Widget
echo "📦 Step 2: Building Widget..."
pnpm exec vite build
if [ $? -eq 0 ]; then
  echo "✅ Widget built successfully!"
else
  echo "❌ Widget build failed!"
  exit 1
fi

echo ""