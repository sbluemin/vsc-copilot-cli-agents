/**
 * Chat Participant 핸들러 생성 함수
 */

import * as vscode from 'vscode';
import { StreamContent } from '../cli/types';
import { formatHealthReport } from '../cli/utils';
import { ParticipantConfig } from './types';

/**
 * 세션 ID 마커 패턴: [](cca:sessionId)
 * 빈 링크 형태로 저장하여 사용자에게 보이지 않음
 */
const SESSION_MARKER_PATTERN = /\[\]\(cca:([^)]+)\)/;

/**
 * Chat History 기반 세션 관리자
 * context.history에서 세션 ID를 검색하고 저장하는 유틸리티
 */
class ChatSessionManager {
  /**
   * history에서 기존 세션 ID 검색
   * @param history - Chat history
   * @returns 세션 ID 또는 undefined
   */
  static findSessionId(history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>): string | undefined {
    for (const turn of history) {
      if (turn instanceof vscode.ChatResponseTurn) {
        for (const part of turn.response) {
          if (part instanceof vscode.ChatResponseMarkdownPart) {
            const match = part.value.value.match(SESSION_MARKER_PATTERN);
            if (match) {
              return match[1];
            }
          }
        }
      }
    }
    return undefined;
  }

  /**
   * 세션 ID를 스트림에 마커로 저장
   * @param stream - Chat response stream
   * @param sessionId - 저장할 세션 ID
   */
  static saveSessionId(stream: vscode.ChatResponseStream, sessionId: string): void {
    stream.markdown(`[](cca:${sessionId})`);
  }
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
    const { cliRunner, name } = config;

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

    // /session 커맨드 처리
    if (request.command === 'session') {
      const sessionId = ChatSessionManager.findSessionId(context.history);
      if (sessionId) {
        stream.markdown(`📍 **Current Session**\n\n`);
        stream.markdown(`- **CLI**: ${name}\n`);
        stream.markdown(`- **Session ID**: \`${sessionId}\`\n\n`);
        stream.markdown(`> This session can be resumed using the CLI directly with:\n> \`\`\`\n> ${cliRunner.name} --resume ${sessionId}\n> \`\`\``);
      } else {
        stream.markdown(`ℹ️ **No Active Session**\n\n`);
        stream.markdown(`Start a conversation with **@${cliRunner.name}** to create a new session.`);
      }
      return;
    }

    // /handoff 커맨드 처리: 대화형 CLI 터미널로 전환
    if (request.command === 'handoff') {
      const sessionId = ChatSessionManager.findSessionId(context.history);
      if (!sessionId) {
        stream.markdown(`❌ **No Active Session**\n\n`);
        stream.markdown(`You need an active session to hand off to the CLI.\n`);
        stream.markdown(`Start a conversation with **@${cliRunner.name}** first, then use \`/handoff\`.`);
        return;
      }

      try {
        // 모델 설정 가져오기
        const ccaConfig = vscode.workspace.getConfiguration('CCA');
        const model = ccaConfig.get<string>(`${cliRunner.name}.model`);

        // CLI 인자 구성
        const shellArgs = ['--resume', sessionId];
        if (model) {
          shellArgs.push('--model', model);
        }

        // 에디터 사이드 영역에 터미널 생성 및 CLI 실행
        const terminal = vscode.window.createTerminal({
          name: `${name} CLI`,
          shellPath: cliRunner.name,
          shellArgs,
          location: {
            viewColumn: vscode.ViewColumn.Beside,
          },
          iconPath: config.iconPath,
        });
        terminal.show();

        stream.markdown(`🚀 **Handoff Successful**\n\n`);
        stream.markdown(`Interactive ${name} CLI has been opened in a side terminal with session \`${sessionId}\`.\n\n`);
        stream.markdown(`> You can continue your conversation directly in the terminal.`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        stream.markdown(`❌ **Error during handoff:** ${errorMessage}`);
      }
      return;
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
