# VS Code Extension Development Guidelines

## Language Conventions

- **Code Comments**: Write all code comments in Korean (한글)
- **User-Facing Messages**: Write all user-facing messages (errors, warnings, info dialogs, etc.) in English
- **Documentation**: Write documentation in English

## Project Structure

```text
copilot-cli-agents/
├── .vscode/           # VS Code configuration files
│   ├── launch.json    # Debug configuration
│   ├── tasks.json     # Build task configuration
│   └── settings.json  # Workspace settings
├── src/
│   ├── extension.ts   # Extension entry point
│   └── test/          # Test files
├── dist/              # Compiled output (esbuild)
├── package.json       # Extension manifest
├── tsconfig.json      # TypeScript configuration
└── esbuild.js         # Bundler configuration
```

## Key Commands

- `npm run compile` - Build the project
- `npm run watch` - Build in watch mode
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `vsce package` - Create .vsix file
- `vsce publish` - Publish to Marketplace

## References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Guides](https://code.visualstudio.com/api/extension-guides/overview)
- [Chat Participant API](https://code.visualstudio.com/api/extension-guides/ai/chat)

## Additional Instructions

**Before modifying any file, follow these steps:**

1. Search for matching instructions in @.github/instructions/*.md
2. Check if the current file matches the `applyTo` pattern in each instruction file
3. If it matches, read the complete instruction file and apply all guidelines
