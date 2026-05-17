#!/usr/bin/env bash
# Enflow Start/Restart Wrapper Script for macOS & Linux

# Determine project directory relative to script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Launch Node.js process manager
node run.js
