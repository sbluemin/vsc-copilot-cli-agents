/**
 * Chat Participant 핸들러 생성 함수
 */

import * as vscode from 'vscode';
import { StreamContent } from '../cli/types';
import { ParticipantConfig } from './types';
import { findCommand, CommandContext } from './command';
import { ChatSessionManager } from './session';

/**
 * 스트리밍 콘텐츠를 VS Code Chat으로 출력
 * @param stream - VS Code Chat Response Stream
 * @param content - 스트리밍 콘텐츠
 */
function handleStreamContent(
  stream: vscode.ChatResponseStream,
  content: StreamContent
): void {
  switch (content.type) {
      case 'tool_use':
        stream.progress(`🔧 Using tool: ${content.toolName || 'unknown'}`);
        break;
      case 'tool_result':
        stream.progress(`📥 Tool result from ${content.toolName || 'unknown'}:\n\`\`\`\n${content.content}\n\`\`\``);
        break;
      default:
        stream.markdown(content.content);
    }
}

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
        const ctx: CommandContext = { request, context, stream, token, config };
        const handled = await command.handler(ctx);
        if (handled) {
          return;
        }
      }
    }

    // 프롬프트가 비어있는 경우
    if (!request.prompt.trim()) {
      stream.markdown(`Please enter a question for **${name}**.`);
      return;
    }

    try {
      // 기존 세션 ID 검색
      const existingSessionId = ChatSessionManager.findSessionId(context.history);

      // AbortController 생성 (취소 토큰 연동)
      const abortController = new AbortController();
      const cancelDisposable = token.onCancellationRequested(() => abortController.abort());

      // CLI 실행 (스트리밍)
      const result = await cliRunner.run(
        {
          prompt: request.prompt,
          abortSignal: abortController.signal,
          resumeSessionId: existingSessionId,
        },
        (content) => handleStreamContent(stream, content)
      );

      // 새 세션 ID가 있고 기존 세션이 없을 경우, 다음 대화에서 찾을 수 있도록 마커 삽입
      if (result.sessionId && !existingSessionId) {
        ChatSessionManager.saveSessionId(stream, result.sessionId);
      }

      // 이벤트 리스너 정리
      cancelDisposable.dispose();

      if (!result.success && result.error) {
        stream.markdown(`\n\n---\n⚠️ **Error:** ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      stream.markdown(`\n\n---\n❌ **Error:** ${errorMessage}`);
    }
  };
}
