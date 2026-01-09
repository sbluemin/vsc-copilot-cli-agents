/**
 * Chat Participant 핸들러 생성 함수
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { StreamContent } from '../cli/types';
import { formatHealthReport } from '../cli/utils';
import { ParticipantConfig } from './types';

/**
 * Copilot 대화 세션 ID 생성
 *
 * ChatContext.history를 기반으로 고유한 세션 ID를 생성합니다.
 * 첫 요청의 프롬프트를 해시하여 동일한 대화 세션을 식별합니다.
 *
 * @param context - Chat Context
 * @param currentPrompt - 현재 프롬프트 (히스토리가 없는 경우 사용)
 * @returns 세션 ID (UUID 형태)
 */
function generateCopilotSessionId(
  context: vscode.ChatContext,
  currentPrompt: string
): string {
  // 히스토리에서 첫 번째 요청 턴 찾기
  const firstRequest = context.history.find(
    (turn) => turn instanceof vscode.ChatRequestTurn
  ) as vscode.ChatRequestTurn | undefined;

  // 첫 요청의 프롬프트 또는 현재 프롬프트 사용
  const baseText = firstRequest?.prompt || currentPrompt;
  
  // 해시 생성 (MD5로 충분, 보안 목적 아님)
  const hash = crypto.createHash('md5').update(baseText).digest('hex');
  
  // UUID 형태로 변환
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

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
    const { cliRunner, name, cliType, sessionStore } = config;

    // /doctor 커맨드 처리
    if (request.command === 'doctor') {
      try {
        stream.progress(`🔍 Checking ${name} CLI status...`);
        const result = await cliRunner.doctor();
        const report = formatHealthReport(result);
        stream.markdown(report);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        stream.markdown(`❌ **Error during health check:** ${errorMessage}`);
      }
      return;
    }

    // 프롬프트가 비어있는 경우
    if (!request.prompt.trim()) {
      stream.markdown(`Please enter a question for **${name}**.`);
      return;
    }

    try {
      // Copilot 세션 ID 생성
      const copilotSessionId = generateCopilotSessionId(context, request.prompt);

      // 기존 CLI 세션 ID 조회
      const existingCliSessionId = sessionStore.getCliSessionId(copilotSessionId, cliType);

      if (existingCliSessionId) {
        stream.progress(`🔄 Resuming session: ${existingCliSessionId.slice(0, 8)}...`);
      }

      // AbortController 생성 (취소 토큰 연동)
      const abortController = new AbortController();
      const cancelDisposable = token.onCancellationRequested(() => abortController.abort());

      // CLI 실행 (스트리밍)
      const result = await cliRunner.run(
        {
          prompt: request.prompt,
          cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
          abortSignal: abortController.signal,
          resumeSessionId: existingCliSessionId,
        },
        (content) => handleStreamContent(stream, content)
      );

      // 이벤트 리스너 정리
      cancelDisposable.dispose();

      // CLI 세션 ID 저장 (새로 받은 경우)
      if (result.sessionId) {
        sessionStore.setCliSessionId(copilotSessionId, cliType, result.sessionId);
      }

      if (!result.success && result.error) {
        stream.markdown(`\n\n---\n⚠️ **Error:** ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      stream.markdown(`\n\n---\n❌ **Error:** ${errorMessage}`);
    }
  };
}
