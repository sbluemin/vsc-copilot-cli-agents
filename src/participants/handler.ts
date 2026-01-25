/**
 * Chat Participant 핸들러 생성 함수
 */

import * as vscode from 'vscode';
import { ExtendedChatRequest, ParticipantConfig } from './types';
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

    // Custom Agent 에이전트 지침 추출 (모든 CLI에서 자동 처리)
    // 중복 전달 방지는 runCliWithStreaming 내부에서 히스토리 기반으로 처리됨
    const agentInstructions = (request as ExtendedChatRequest).modeInstructions2;

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
          agentInstructions,
          prompt: request.prompt || undefined
        };
        const handled = await command.handler(ctx);
        if (handled) {
          return;
        }
      }
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
      agentInstructions,
    });
  };
}

