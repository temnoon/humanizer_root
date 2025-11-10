#!/bin/bash
# Verification script for Node.js version configuration
# This tests that Node 22 is correctly set as default across all shell scenarios

echo "========================================"
echo "Node.js Version Verification Script"
echo "========================================"
echo ""

# Test 1: NVM Default Alias
echo "Test 1: NVM Default Alias"
echo "------------------------"
source ~/.nvm/nvm.sh
nvm alias default
echo ""

# Test 2: Zsh Login Shell
echo "Test 2: Zsh Login Shell"
echo "------------------------"
zsh -l -c 'node --version'
echo ""

# Test 3: Zsh Interactive Shell
echo "Test 3: Zsh Interactive Shell"
echo "------------------------"
zsh -c 'source ~/.zshrc > /dev/null 2>&1 && node --version'
echo ""

# Test 4: Bash Login Shell
echo "Test 4: Bash Login Shell (.bash_profile)"
echo "------------------------"
bash -l -c 'node --version'
echo ""

# Test 5: Bash Interactive Shell
echo "Test 5: Bash Interactive Shell (.bashrc)"
echo "------------------------"
bash -c 'source ~/.bashrc && node --version'
echo ""

# Test 6: Project Directory with .nvmrc
echo "Test 6: Project Directory (cloud-workbench)"
echo "------------------------"
cd /Users/tem/humanizer_root/cloud-workbench
bash -c 'source ~/.bashrc && node --version'
echo ""

# Test 7: Project Root with .nvmrc
echo "Test 7: Project Root (humanizer_root)"
echo "------------------------"
cd /Users/tem/humanizer_root
bash -c 'source ~/.bashrc && node --version'
echo ""

# Test 8: Workers API with .nvmrc
echo "Test 8: Workers API Directory"
echo "------------------------"
cd /Users/tem/humanizer_root/workers/npe-api
bash -c 'source ~/.bashrc && node --version'
echo ""

# Summary
echo "========================================"
echo "Summary"
echo "========================================"
echo ""
echo "Expected: v22.21.1 in all tests"
echo ""
echo "If any test shows v18.20.8 or another version:"
echo "  1. Open a NEW terminal window"
echo "  2. Run: node --version"
echo "  3. Should show v22.21.1"
echo ""
echo "To manually switch current shell:"
echo "  source ~/.zshrc     (for zsh)"
echo "  source ~/.bashrc    (for bash)"
echo ""
