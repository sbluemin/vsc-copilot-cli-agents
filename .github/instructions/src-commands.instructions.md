---
description: 'VS Code Extension Command Implementation Conventions for src/commands folder'
applyTo: 'src/commands/**'
---

# Commands Module Implementation Conventions

This document defines the structure and patterns to follow when implementing commands in a VS Code Extension.

## Folder Structure

```
src/commands/
├── index.ts          # Module entry point (exports only)
├── types.ts          # Type definitions
├── register.ts       # Command registration module
└── cmd-*.ts          # Individual command implementations (e.g., cmd-scaffold.ts)
```

## File Responsibilities

### 1. types.ts
- Contains command-related type definitions.
- Defines the `CommandConfig` interface to standardize command configuration.

```typescript
export interface CommandConfig {
  /** Command ID (must match the one defined in package.json) */
  id: string;
  /** Command execution function */
  handler: (context: vscode.ExtensionContext) => (...args: unknown[]) => Promise<void> | void;
}
```

### 2. cmd-*.ts (Individual Command Implementation)
- Command files use the `cmd-` prefix (e.g., `cmd-scaffold.ts`).
- Each file is responsible for a single command implementation.
- Export a `CommandConfig` object at the end of the file.
- Helper functions are defined internally and not exposed externally.

**Structure Example:**
```typescript
import * as vscode from 'vscode';
import { CommandConfig } from './types';

// Helper functions (not exposed externally)
function helperFunction(): void {
  // Implementation
}

// Command handler (not exposed externally)
async function handleMyCommand(): Promise<void> {
  // Implementation
}

// Export CommandConfig object (used by register.ts)
export const myCommand: CommandConfig = {
  id: 'extension-id.my-command',
  handler: () => handleMyCommand,
};
```

### 3. register.ts
- Central module that registers all commands.
- Exports `registerAllCommands` function to be called from extension.ts.
- Imports `CommandConfig` objects exported from each cmd-*.ts file and manages them in an array.

**Structure:**
```typescript
import * as vscode from 'vscode';
import { CommandConfig } from './types';
import { myCommand } from './cmd-my-command';

const commands: CommandConfig[] = [myCommand];

function registerCommand(
  context: vscode.ExtensionContext,
  config: CommandConfig
): vscode.Disposable {
  return vscode.commands.registerCommand(config.id, config.handler(context));
}

export function registerAllCommands(context: vscode.ExtensionContext): void {
  for (const config of commands) {
    const disposable = registerCommand(context, config);
    context.subscriptions.push(disposable);
    console.log(`[extension-name] Registered command: ${config.id}`);
  }
}
```

### 4. index.ts
- Module entry point that only performs exports.
- Re-exports only the types and functions to be used externally.

```typescript
export * from './types';
export { registerAllCommands } from './register';
```

## Command Implementation Guidelines

### 1. Naming Conventions
- Command file: `cmd-<action-name>.ts` (kebab-case)
- CommandConfig object: `<actionName>Command` (camelCase)
- Handler function: `handle<ActionName>` (PascalCase)

### 2. Error Handling
- Provide clear error messages to users.
- Use `vscode.window.showErrorMessage`, `showWarningMessage`, and `showInformationMessage` appropriately.

### 3. Asynchronous Operations
- Command handlers use `async/await`.
- Implement proper cancellation handling when users can cancel operations.

### 4. User Interaction
- Use `vscode.window.showQuickPick`, `showInputBox`, etc. to receive user input.
- Display work progress using `vscode.window.withProgress`.

### 5. Logging
- Log important operations to console: `console.log('[extension-name] ...')`
- Maintain consistent log formatting.

## Procedure for Adding New Commands

1. **Declare command in package.json**
   ```json
   "contributes": {
     "commands": [
       {
         "command": "extension-id.my-command",
         "title": "My Command",
         "category": "Extension Category"
       }
     ]
   }
   ```

2. **Create cmd-*.ts file**
   - Implement helper functions and handler function
   - Export `CommandConfig` object

3. **Register command in register.ts**
   - Add import
   - Add to `commands` array

4. **Test**
   - Run Extension Development Host with F5
   - Test command from Command Palette

## Notes

- This pattern is similar to the `src/participants` folder structure.
- Maintains a scalable and maintainable structure.
- Each command should be independently developable and testable.
