/**
 * Chat Participant 핸들러 생성 함수
 */

import * as vscode from 'vscode';
import { ExtendedChatRequest, ModeInstructions, ParticipantConfig } from './types';
import { findCommand, CommandContext } from './command';
import { runCliWithStreaming } from './feature/utils';

/**
 * Chat Participant 핸들러 생성
 * @param config - Participant 설정
 * @returns Chat Request Handler
 */
export function createParticipantHandler(
  config: ParticipantConfig
): vscode.ChatRequestHandler {
  return async (
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> => {
    const { cliRunner, name } = config;

    // 커맨드 처리: 등록된 커맨드 찾기 및 실행
    if (request.command) {
      const command = findCommand(request.command);
      if (command) {
        const ctx: CommandContext = { 
          request, 
          context, 
          stream, 
          token, 
          config, 
          prompt: request.prompt || undefined
        };
        const handled = await command.handler(ctx);
        if (handled) {
          return;
        }
      }
    }

    // Claude 전용: modeInstructions2 처리 (이외의 CLI는 '/passAgent' 커맨드 사용)
    let modeInstructions: ModeInstructions | undefined;
    if (cliRunner.name === 'claude') {
      modeInstructions = (request as ExtendedChatRequest).modeInstructions2;
    }

    // 일반 처리: CLI 실행
    await runCliWithStreaming({
      cliRunner,
      name,
      prompt: request.prompt,
      references: request.references,
      history: context.history,
      stream,
      token,
      modeInstructions,
    });
  };
}

