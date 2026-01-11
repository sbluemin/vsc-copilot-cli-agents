/**
 * Commands 등록 모듈
 */

import * as vscode from 'vscode';
import { CommandConfig } from './types';
import { scaffoldLlmCommand } from './feature/scaffold';

/**
 * 등록할 커맨드 목록
 */
const commands: CommandConfig[] = [scaffoldLlmCommand];

/**
 * 단일 커맨드 등록
 */
function registerCommand(
  context: vscode.ExtensionContext,
  config: CommandConfig
): vscode.Disposable {
  return vscode.commands.registerCommand(config.id, config.handler);
}

/**
 * 모든 커맨드 등록
 * @param context - VS Code Extension Context
 */
export function registerAllCommands(context: vscode.ExtensionContext): void {
  for (const config of commands) {
    const disposable = registerCommand(context, config);
    context.subscriptions.push(disposable);
    console.log(`[copilot-cli-agents] Registered command: ${config.id}`);
  }
}
