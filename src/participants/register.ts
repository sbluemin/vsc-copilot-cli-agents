/**
 * Chat Participant 등록 모듈
 */

import * as vscode from 'vscode';
import { ParticipantConfig } from './types';
import { createParticipantHandler } from './handler';
import { createClaudeParticipant } from './feature/claude';
import { createGeminiParticipant } from './feature/gemini';

/** Participant 생성 함수 타입 */
type ParticipantFactory = () => ParticipantConfig;

/** 등록할 Participant 생성 함수 목록 */
const participantFactories: ParticipantFactory[] = [
  createGeminiParticipant,
  createClaudeParticipant,
];

/**
 * 단일 Chat Participant 등록
 */
function registerParticipant(
  context: vscode.ExtensionContext,
  config: ParticipantConfig
): vscode.Disposable {
  // 아이콘 경로 설정
  const iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', `${config.cliRunner.name}.svg`);
  config.iconPath = iconPath;

  const handler = createParticipantHandler(config);
  const participant = vscode.chat.createChatParticipant(config.id, handler);
  
  // Chat Participant 아이콘 설정
  participant.iconPath = iconPath;

  return participant;
}

/**
 * 모든 Chat Participant 등록
 * @param context - VS Code Extension Context
 */
export function registerAllParticipants(context: vscode.ExtensionContext): void {
  // Participant 설정 생성 및 등록
  for (const factory of participantFactories) {
    const config = factory();
    const disposable = registerParticipant(context, config);
    context.subscriptions.push(disposable);
    console.log(`[copilot-cli-agents] Registered chat participant: @${config.cliRunner.name}`);
  }
}
