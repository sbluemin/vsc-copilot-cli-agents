/**
 * Chat Participant 핸들러 생성 함수
 */

import * as vscode from 'vscode';
import { CliRunner, StreamContent } from '../cli/types';
import { resolveFileReferences } from '../cli/utils';
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
 * CLI 실행 옵션
 */
export interface RunCliOptions {
  /** CLI Runner 인스턴스 */
  cliRunner: CliRunner;
  /** Participant 이름 (빈 프롬프트 메시지용) */
  name: string;
  /** 프롬프트 (파일 참조 치환 전) */
  prompt: string;
  /** 파일 참조 목록 */
  references: readonly vscode.ChatPromptReference[];
  /** 채팅 히스토리 */
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>;
  /** 응답 스트림 */
  stream: vscode.ChatResponseStream;
  /** 취소 토큰 */
  token: vscode.CancellationToken;
  /** 시스템 프롬프트 (선택적) */
  systemPrompt?: string;
  /** 커맨드 이름 (선택적, 빈 프롬프트 메시지용) */
  commandName?: string;
}

/**
 * CLI 실행 공통 로직
 * @param options - CLI 실행 옵션
 * @returns 성공 여부
 */
export async function runCliWithStreaming(options: RunCliOptions): Promise<boolean> {
  const { cliRunner, name, prompt, references, history, stream, token, systemPrompt, commandName } = options;

  // 프롬프트가 비어있는 경우
  if (!prompt.trim()) {
    const suffix = commandName ? ` with \`/${commandName}\`` : '';
    stream.markdown(`Please enter a question for **${name}**${suffix}.`);
    return false;
  }

  // 기존 세션 ID 검색
  const existingSessionId = ChatSessionManager.findSessionId(history);

  // AbortController 생성 (취소 토큰 연동)
  const abortController = new AbortController();
  const cancelDisposable = token.onCancellationRequested(() => abortController.abort());

  // #file:~ 참조를 실제 파일 경로로 치환
  const resolvedPrompt = resolveFileReferences(prompt, references);

  // CLI 실행 (스트리밍)
  const result = await cliRunner.run(
    {
      prompt: resolvedPrompt,
      systemPrompt,
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
    return false;
  }

  return true;
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

    await runCliWithStreaming({
      cliRunner,
      name,
      prompt: request.prompt,
      references: request.references,
      history: context.history,
      stream,
      token,
    });
  };
}

