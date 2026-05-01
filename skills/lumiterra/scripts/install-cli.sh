#!/usr/bin/env bash
set -euo pipefail

# Lumiterra CLI installation script for agent use.
#
# After public release this can become:
#   npm install -g lumiterra-cli
# During internal testing, package.json is private and the package is not
# available from the npm registry, so this script fails with guidance.

if command -v lumiterra &> /dev/null; then
  installed=$(lumiterra --version 2>/dev/null || echo "unknown")
  echo "lumiterra CLI is installed (version $installed)"
  exit 0
fi

echo "error: lumiterra CLI is not installed; this package is currently internal and is not published to the npm registry."
echo "Ask the maintainer for the local package or installation instructions."
exit 1
