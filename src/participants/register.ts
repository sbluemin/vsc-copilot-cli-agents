/**
 * Chat Participant 등록 모듈
 */

import * as vscode from 'vscode';
import { geminiCli, claudeCli } from '../cli';
import { ParticipantConfig } from './types';
import { createParticipantHandler } from './handler';

/**
 * Gemini Participant 설정
 */
const geminiConfig: ParticipantConfig = {
  id: 'copilot-cli-agents.gemini',
  name: 'Gemini',
  description: 'Google Gemini AI Assistant',
  cliRunner: geminiCli,
};

/**
 * Claude Participant 설정
 */
const claudeConfig: ParticipantConfig = {
  id: 'copilot-cli-agents.claude',
  name: 'Claude',
  description: 'Anthropic Claude AI Assistant',
  cliRunner: claudeCli,
};

/**
 * 단일 Chat Participant 등록
 */
function registerParticipant(
  context: vscode.ExtensionContext,
  config: ParticipantConfig
): vscode.Disposable {
  const handler = createParticipantHandler(config);
  const participant = vscode.chat.createChatParticipant(config.id, handler);
  
  // 아이콘 설정
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', `${config.cliRunner.name}.svg`);

  return participant;
}

/**
 * 모든 Chat Participant 등록
 * @param context - VS Code Extension Context
 */
export function registerAllParticipants(context: vscode.ExtensionContext): void {
  const participants = [geminiConfig, claudeConfig];

  for (const config of participants) {
    const disposable = registerParticipant(context, config);
    context.subscriptions.push(disposable);
    console.log(`[copilot-cli-agents] Registered chat participant: @${config.cliRunner.name}`);
  }
}
