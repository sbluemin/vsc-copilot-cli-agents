---
description: 'VS Code Extension Chat Participant Implementation Conventions for src/participants folder'
applyTo: 'src/participants/**'
---

# Participants Module Implementation Conventions

This document defines the structure and patterns to follow when implementing Chat Participants in a VS Code Extension.

## Folder Structure

```
src/participants/
├── index.ts              # Module entry point (exports only)
├── types.ts              # Type definitions
├── session.ts            # Chat session management utility
├── register.ts           # Participant registration module
├── handler.ts            # Common participant handler logic
├── feature/              # Individual participant implementations
│   └── <cli-name>.ts     # Participant implementation (e.g., claude.ts, gemini.ts)
└── command/              # Participant command implementations
    ├── index.ts          # Command module entry point
    ├── types.ts          # Command type definitions
    └── feature/          # Individual command implementations
        └── <command>.ts  # Command implementation (e.g., doctor.ts, session.ts)
```

## File Responsibilities

### 1. types.ts
- Contains participant-related type definitions.
- Defines the `ParticipantConfig` interface to standardize participant configuration.

```typescript
export interface ParticipantConfig {
  /** Participant ID (must match the one defined in package.json) */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** CLI Runner instance */
  cliRunner: CliRunner;
  /** CLI type for session management */
  cliType: CliType;
  /** Session store instance */
  sessionStore: SessionStore;
}
```

### 2. feature/<cli-name>.ts (Individual Participant Implementation)
- Participant files are placed in the `feature/` directory with CLI names (e.g., `claude.ts`, `gemini.ts`).
- Each file is responsible for a single participant implementation (CLI runner + config).
- Export a factory function that creates `ParticipantConfig` at the end of the file.
- The CLI runner class and helper functions are defined internally and not exposed externally.

**Structure Example:**
```typescript
import * as vscode from 'vscode';
import { SpawnCliRunner, ParseResult } from '../../cli/spawnCliRunner';
import { SessionStore } from '../../cli/session';
import { ParticipantConfig } from '../types';

// CLI Runner implementation (not exposed externally)
class MyCliRunner extends SpawnCliRunner {
  readonly name = 'my-cli';
  // ... implementation
}

// Singleton instance (not exposed externally)
const myCli = new MyCliRunner();

// Export factory function (used by register.ts)
export function createMyParticipant(sessionStore: SessionStore): ParticipantConfig {
  return {
    id: 'extension-id.my-participant',
    name: 'My Participant',
    description: 'My AI Assistant',
    cliRunner: myCli,
    cliType: 'my-cli',
    sessionStore,
  };
}
```

### 3. handler.ts
- Contains common handler logic shared across all participants.
- Exports `createParticipantHandler` function that creates the actual request handler.
- Delegates command handling to the `command/` module via `findCommand()`.
- Handles common functionality like session management, streaming, and error handling.

### 4. session.ts
- Contains `ChatSessionManager` class for session ID management.
- Uses hidden markdown markers (`[](cca:sessionId)`) to persist session IDs in chat history.
- Provides `findSessionId()` and `saveSessionId()` static methods.

### 5. register.ts
- Central module that registers all participants.
- Exports `registerAllParticipants` function to be called from extension.ts.
- Imports factory functions from each feature/*.ts file and manages them in an array.

**Structure:**
```typescript
import * as vscode from 'vscode';
import { SessionStore } from '../cli/session';
import { ParticipantConfig } from './types';
import { createParticipantHandler } from './handler';
import { createClaudeParticipant } from './feature/claude';
import { createGeminiParticipant } from './feature/gemini';

type ParticipantFactory = (sessionStore: SessionStore) => ParticipantConfig;

const participantFactories: ParticipantFactory[] = [
  createGeminiParticipant,
  createClaudeParticipant,
];

function registerParticipant(
  context: vscode.ExtensionContext,
  config: ParticipantConfig
): vscode.Disposable {
  const handler = createParticipantHandler(config);
  const participant = vscode.chat.createChatParticipant(config.id, handler);
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', `${config.cliRunner.name}.svg`);
  return participant;
}

export function registerAllParticipants(context: vscode.ExtensionContext): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    console.warn('[copilot-cli-agents] No workspace folder found');
    return;
  }

  const sessionStore = new SessionStore(workspaceRoot);
  sessionStore.cleanup();

  for (const factory of participantFactories) {
    const config = factory(sessionStore);
    const disposable = registerParticipant(context, config);
    context.subscriptions.push(disposable);
    console.log(`[copilot-cli-agents] Registered: @${config.cliRunner.name}`);
  }
}
```

### 6. index.ts
- Module entry point that only performs exports.
- Re-exports only the types and functions to be used externally.

```typescript
export * from './types';
export * from './handler';
export * from './session';
export * from './command';
export { registerAllParticipants } from './register';
```

## Participant Command Module

### command/types.ts
- Defines `CommandContext` interface for command handler context.
- Defines `CommandHandler` function type.
- Defines `ParticipantCommand` interface for command configuration.

```typescript
export interface CommandContext {
  request: vscode.ChatRequest;
  context: vscode.ChatContext;
  stream: vscode.ChatResponseStream;
  token: vscode.CancellationToken;
  config: ParticipantConfig;
}

export type CommandHandler = (ctx: CommandContext) => Promise<boolean>;

export interface ParticipantCommand {
  name: string;
  description: string;
  handler: CommandHandler;
}
```

### command/feature/<command>.ts (Individual Command Implementation)
- Command files are placed in the `command/feature/` directory.
- Each file is responsible for a single command implementation.
- Export the command configuration object at the end of the file.

**Structure Example:**
```typescript
import { ParticipantCommand, CommandContext } from '../types';
import { ChatSessionManager } from '../../session';

async function handleMyCommand(ctx: CommandContext): Promise<boolean> {
  const { stream, config } = ctx;
  // Command implementation
  stream.markdown('Command executed successfully!');
  return true;
}

export const myCommand: ParticipantCommand = {
  name: 'my-command',
  description: 'My command description',
  handler: handleMyCommand,
};
```

### command/index.ts
- Module entry point that exports types and all commands.
- Provides `findCommand()` function to look up commands by name.
- Maintains `participantCommands` array of all registered commands.

```typescript
export * from './types';
export { doctorCommand } from './feature/doctor';
export { sessionCommand } from './feature/session';
export { handoffCommand } from './feature/handoff';

import { ParticipantCommand } from './types';
import { doctorCommand } from './feature/doctor';
import { sessionCommand } from './feature/session';
import { handoffCommand } from './feature/handoff';

export const participantCommands: ParticipantCommand[] = [
  doctorCommand,
  sessionCommand,
  handoffCommand,
];

export function findCommand(commandName: string): ParticipantCommand | undefined {
  return participantCommands.find((cmd) => cmd.name === commandName);
}
```

## Participant Implementation Guidelines

### 1. Naming Conventions
- Participant file: `feature/<cli-name>.ts` (kebab-case)
- CLI Runner class: `<CliName>CliRunner` (PascalCase)
- Factory function: `create<CliName>Participant` (camelCase with create prefix)

### 2. CLI Runner Implementation
- Extend `SpawnCliRunner` abstract class.
- Implement required abstract methods:
  - `buildCliOptions()`: Build CLI command and arguments
  - `buildPromptArgument()`: Build prompt argument format
  - `parseLineWithSession()`: Parse streaming JSON output
  - `checkInstallation()`: Verify CLI installation
  - `getInstallGuidance()`: Provide installation instructions

### 3. Error Handling
- Provide clear error messages to users via `stream.markdown()`.
- Handle installation check failures gracefully with `/doctor` command.

### 4. Session Management
- Use the injected `SessionStore` for session persistence.
- Map Copilot session IDs to CLI session IDs for conversation continuity.

### 5. Streaming Output
- Use `stream.markdown()` for text content.
- Use `stream.progress()` for tool usage status.
- Handle all `StreamContent` types: 'text', 'tool_use', 'tool_result'.

### 6. Logging
- Log important operations to console: `console.log('[copilot-cli-agents] ...')`
- Maintain consistent log formatting.

## Procedure for Adding New Participants

1. **Declare participant in package.json**
   ```json
   "contributes": {
     "chatParticipants": [
       {
         "id": "copilot-cli-agents.my-participant",
         "name": "my-participant",
         "description": "My AI Assistant",
         "isSticky": true,
         "commands": [
           {
             "name": "doctor",
             "description": "Check CLI health status"
           }
         ]
       }
     ]
   }
   ```

2. **Create feature/<cli-name>.ts file**
   - Implement CLI Runner class extending `SpawnCliRunner`
   - Create singleton instance
   - Export factory function

3. **Register participant in register.ts**
   - Add import from `./feature/<cli-name>`
   - Add to `participantFactories` array

4. **Add icon asset**
   - Add `assets/<cli-name>.svg` for participant icon

5. **Test**
   - Run Extension Development Host with F5
   - Test participant from Chat panel (@participant-name)
   - Test /doctor command for health check

## Procedure for Adding New Commands

1. **Declare command in package.json**
   ```json
   "chatParticipants": [
     {
       "id": "copilot-cli-agents.my-participant",
       "commands": [
         {
           "name": "my-command",
           "description": "My command description"
         }
       ]
     }
   ]
   ```

2. **Create command/feature/<command>.ts file**
   - Implement command handler function
   - Export command configuration object

3. **Register command in command/index.ts**
   - Add import from `./feature/<command>`
   - Add to `participantCommands` array
   - Add to exports

4. **Test**
   - Run Extension Development Host with F5
   - Test command from Chat panel (/command-name)
