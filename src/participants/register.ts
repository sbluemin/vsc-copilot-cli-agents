/**
 * Chat Participant 등록 모듈
 */

import * as vscode from 'vscode';
import { geminiCli, claudeCli } from '../cli';
import { SessionStore } from '../session';
import { ParticipantConfig } from './types';
import { createParticipantHandler } from './handler';

/**
 * Participant 설정 생성 (세션 저장소 포함)
 */
function createParticipantConfigs(sessionStore: SessionStore): ParticipantConfig[] {
  return [
    {
      id: 'copilot-cli-agents.gemini',
      name: 'Gemini',
      description: 'Google Gemini AI Assistant',
      cliRunner: geminiCli,
      cliType: 'gemini',
      sessionStore,
    },
    {
      id: 'copilot-cli-agents.claude',
      name: 'Claude',
      description: 'Anthropic Claude AI Assistant',
      cliRunner: claudeCli,
      cliType: 'claude',
      sessionStore,
    },
  ];
}

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
  // 워크스페이스 루트 경로 확인
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    console.warn('[copilot-cli-agents] No workspace folder found, session persistence disabled');
    return;
  }

  // 세션 저장소 생성
  const sessionStore = new SessionStore(workspaceRoot);

  // 오래된 세션 정리 (7일 이상)
  sessionStore.cleanup();

  // Participant 설정 생성 및 등록
  const participants = createParticipantConfigs(sessionStore);

  for (const config of participants) {
    const disposable = registerParticipant(context, config);
    context.subscriptions.push(disposable);
    console.log(`[copilot-cli-agents] Registered chat participant: @${config.cliRunner.name}`);
  }

  console.log(`[copilot-cli-agents] Session store initialized with ${sessionStore.sessionCount} existing sessions`);
}
