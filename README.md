# Copilot CLI Agents

Copilot extension for integrating multiple Code Agent CLIs directly into VS Code Copilot Chat.

## Motivation

GitHub Copilot provides a highly structured and well-integrated development experience, offering fine-grained control for Agent Coding. However, as a product specialized for coding, its underlying models often come with restricted Context Windows.

On the other hand, pure models like Gemini and Claude (such as Sonnet 4.5 with its 1M context window) provide extensive context capabilities. Switching contexts or applications to leverage these large-context models creates unnecessary friction. This extension aims to bridge this gap, allowing developers to utilize these powerful CLIs without leaving the VS Code Copilot Agent environment.

## Features

This extension adds the following chat participants to GitHub Copilot:

- **@gemini**: Google Gemini AI Assistant
- **@claude**: Anthropic Claude AI Assistant

> **Note**: Since Gemini and Claude are used directly as CLIs, Copilot's request processing is not used.

## Usage

1. Open GitHub Copilot Chat in VS Code.
2. Type `@gemini` or `@claude` followed by your query.

## Roadmap

- **Context Persistence**: Maintain CLI context and history aligned with Copilot chat sessions.
- **Codex CLI Integration**: Expand support to include the Codex CLI.
- **Extended CLI Configuration**: Enable support for diverse CLI options and arguments.

## Requirements

- VS Code ^1.107.0
- GitHub Copilot Chat extension
