# PR Analyzer for Atlas Codex

This folder contains the PR analyzer agent for reviewing Atlas Codex pull requests.

## How to Use

When you want Claude to review a pull request:

1. Point Claude to read the `pr-analyzer.md` file in this folder
2. Ask Claude to act as the PR analyzer agent described in that file
3. Provide the PR number or details you want reviewed

## Example Usage

```
Hey Claude, please read the pr-analyzer.md file in the "start here - pr analyzer" folder and act as that agent. 

I want you to review PR #123 - please analyze the changes and provide a comprehensive review following the format specified in the agent file.
```

## Agent Capabilities

The PR analyzer is specialized for:
- Atlas Codex extraction system protection
- Security vulnerability detection
- Performance analysis
- Code quality enforcement
- Breaking change detection
- API compatibility verification

See `pr-analyzer.md` for the complete agent definition and capabilities.