#!/bin/bash

# Atlas Codex PR Analyzer Agent - Invocation Script
# This script helps invoke the PR analyzer agent for pull request reviews

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AGENT_DIR="$(dirname "$0")"
AGENT_PROMPT="$AGENT_DIR/AGENT_PROMPT.md"
AGENT_SPEC="$AGENT_DIR/agent-spec.json"

# Function to print colored output
print_color() {
    color=$1
    message=$2
    echo -e "${color}${message}${NC}"
}

# Function to display usage
usage() {
    echo "Atlas Codex PR Analyzer Agent"
    echo ""
    echo "Usage: $0 [OPTIONS] PR_NUMBER"
    echo ""
    echo "Options:"
    echo "  -c, --command COMMAND    Specify review command (review, security-check, performance-check, extraction-check, quick-review)"
    echo "  -r, --repo REPO         GitHub repository (default: coreydylan/atlascodex)"
    echo "  -o, --output FILE       Output file for review (default: pr-review.md)"
    echo "  -p, --post              Post review as PR comment"
    echo "  -h, --help              Display this help message"
    echo ""
    echo "Examples:"
    echo "  $0 123                          # Review PR #123"
    echo "  $0 -c security-check 456        # Security check for PR #456"
    echo "  $0 -p 789                       # Review and post comment on PR #789"
    echo "  $0 -o review.md 234             # Save review to review.md"
}

# Default values
COMMAND="review"
REPO="coreydylan/atlascodex"
OUTPUT_FILE="pr-review.md"
POST_COMMENT=false
PR_NUMBER=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--command)
            COMMAND="$2"
            shift 2
            ;;
        -r|--repo)
            REPO="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -p|--post)
            POST_COMMENT=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            PR_NUMBER="$1"
            shift
            ;;
    esac
done

# Validate PR number
if [ -z "$PR_NUMBER" ]; then
    print_color "$RED" "Error: PR number is required"
    usage
    exit 1
fi

print_color "$BLUE" "🤖 Atlas Codex PR Analyzer Agent v1.0.0"
print_color "$BLUE" "========================================"
echo ""

# Check for required files
if [ ! -f "$AGENT_PROMPT" ]; then
    print_color "$RED" "Error: Agent prompt file not found: $AGENT_PROMPT"
    exit 1
fi

if [ ! -f "$AGENT_SPEC" ]; then
    print_color "$RED" "Error: Agent specification file not found: $AGENT_SPEC"
    exit 1
fi

# Check for GitHub CLI
if ! command -v gh &> /dev/null; then
    print_color "$RED" "Error: GitHub CLI (gh) is not installed"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

print_color "$YELLOW" "📋 Fetching PR #$PR_NUMBER from $REPO..."

# Fetch PR information
PR_INFO=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json title,body,author,headRefName,baseRefName,files,additions,deletions 2>/dev/null || {
    print_color "$RED" "Error: Failed to fetch PR #$PR_NUMBER"
    exit 1
})

# Extract PR details
PR_TITLE=$(echo "$PR_INFO" | jq -r .title)
PR_AUTHOR=$(echo "$PR_INFO" | jq -r .author.login)
PR_BRANCH=$(echo "$PR_INFO" | jq -r .headRefName)
PR_BASE=$(echo "$PR_INFO" | jq -r .baseRefName)
FILES_CHANGED=$(echo "$PR_INFO" | jq -r '.files | length')
LINES_ADDED=$(echo "$PR_INFO" | jq -r .additions)
LINES_REMOVED=$(echo "$PR_INFO" | jq -r .deletions)

print_color "$GREEN" "✓ PR #$PR_NUMBER: $PR_TITLE"
echo "  Author: $PR_AUTHOR"
echo "  Branch: $PR_BRANCH -> $PR_BASE"
echo "  Files: $FILES_CHANGED | +$LINES_ADDED -$LINES_REMOVED"
echo ""

print_color "$YELLOW" "📝 Fetching PR diff..."

# Get PR diff
PR_DIFF=$(gh pr diff "$PR_NUMBER" --repo "$REPO" 2>/dev/null || {
    print_color "$RED" "Error: Failed to fetch PR diff"
    exit 1
})

# Create temporary file with context for Claude
CONTEXT_FILE=$(mktemp)
cat > "$CONTEXT_FILE" << EOF
# Pull Request Review Request

## Repository: $REPO
## PR Number: #$PR_NUMBER
## Command: /$COMMAND

## PR Information
- Title: $PR_TITLE
- Author: $PR_AUTHOR
- Branch: $PR_BRANCH -> $PR_BASE
- Files Changed: $FILES_CHANGED
- Lines Added: $LINES_ADDED
- Lines Removed: $LINES_REMOVED

## PR Description
$(echo "$PR_INFO" | jq -r .body)

## PR Diff
\`\`\`diff
$PR_DIFF
\`\`\`

## Agent Prompt
$(cat "$AGENT_PROMPT")

## Instructions
Please analyze this pull request using the Atlas Codex PR Analyzer agent capabilities. Follow the /$COMMAND directive and provide a comprehensive review according to the agent specifications.
EOF

print_color "$YELLOW" "🔍 Analyzing PR with command: /$COMMAND..."

# Here you would invoke Claude API with the context
# For demonstration, we'll create a placeholder
cat > "$OUTPUT_FILE" << EOF
## 📊 PR Analysis: $PR_TITLE

### 📋 Summary
Analysis of PR #$PR_NUMBER by Atlas Codex PR Analyzer Agent

### 🔍 Changes Overview
- **Files Modified**: $FILES_CHANGED files
- **Lines Added**: +$LINES_ADDED
- **Lines Removed**: -$LINES_REMOVED

### ⚠️ Risk Assessment
*Agent analysis would appear here*

### 📝 Detailed Review
*Detailed review based on $COMMAND would appear here*

### 📊 Approval Status
**Decision**: PENDING_CLAUDE_ANALYSIS

---
*To complete this review, integrate with Claude API*
*Agent: Atlas Codex PR Analyzer v1.0.0*
EOF

print_color "$GREEN" "✓ Review saved to: $OUTPUT_FILE"

# Post comment if requested
if [ "$POST_COMMENT" = true ]; then
    print_color "$YELLOW" "💬 Posting review as PR comment..."
    gh pr comment "$PR_NUMBER" --repo "$REPO" --body-file "$OUTPUT_FILE" && {
        print_color "$GREEN" "✓ Review posted successfully!"
    } || {
        print_color "$RED" "Error: Failed to post comment"
    }
fi

# Cleanup
rm -f "$CONTEXT_FILE"

print_color "$BLUE" ""
print_color "$BLUE" "Review complete! 🎉"

# Check for critical issues in review
if grep -q "REJECTED\|CHANGES_REQUESTED" "$OUTPUT_FILE"; then
    print_color "$YELLOW" "⚠️  This PR requires changes before merging"
    exit 1
elif grep -q "APPROVED" "$OUTPUT_FILE"; then
    print_color "$GREEN" "✅ This PR is approved for merging"
    exit 0
else
    print_color "$BLUE" "ℹ️  Review status pending Claude analysis"
    exit 0
fi