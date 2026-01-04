/**
 * Chat Participant 핸들러 생성 함수
 */

import * as vscode from 'vscode';
import { StreamContent } from '../cli/types';
import { ParticipantConfig } from './types';

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
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> => {
    const { cliRunner, name } = config;

    // 프롬프트가 비어있는 경우
    if (!request.prompt.trim()) {
      stream.markdown(`Please enter a question for **${name}**.`);
    }

    try {
      // AbortController 생성 (취소 토큰 연동)
      const abortController = new AbortController();
      const cancelDisposable = token.onCancellationRequested(() => abortController.abort());

      // CLI 실행 (스트리밍)
      const result = await cliRunner.run(
        {
          prompt: request.prompt,
          cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
          abortSignal: abortController.signal,
        },
        (content) => handleStreamContent(stream, content)
      );

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
