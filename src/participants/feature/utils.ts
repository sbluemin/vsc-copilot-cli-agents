/**
 * Participant Feature 공통 유틸리티 함수
 * CLI 실행 스트리밍 등 여러 participant 및 command에서 공유하는 로직을 제공합니다.
 */

import * as vscode from 'vscode';
import { CliRunner, StreamContent } from '../../cli/types';
import { resolveFileReferences } from './promptProcessor';
import { AgentInstructions } from '../types';
import { ChatSessionManager } from '../session';

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
  /** 에이전트 지침 (선택적) */
  agentInstructions?: AgentInstructions;
  /** 커맨드 이름 (선택적, 빈 프롬프트 메시지용) */
  commandName?: string;
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
    case 'reasoning':
      stream.progress(`💭 ${content.content}`);
      break;
    default:
      stream.markdown(content.content);
  }
}

/**
 * CLI 실행 공통 로직
 * @param options - CLI 실행 옵션
 * @returns 성공 여부
 */
export async function runCliWithStreaming(options: RunCliOptions): Promise<boolean> {
  const { cliRunner, name, prompt, references, history, stream, token, agentInstructions, commandName } = options;

  // 프롬프트가 비어있는 경우
  if (!prompt.trim()) {
    const suffix = commandName ? ` with \`/${commandName}\`` : '';
    stream.markdown(`Please enter a question for **${name}**${suffix}.`);
    return false;
  }

  // 기존 세션 ID 검색
  const existingSessionId = ChatSessionManager.findSessionId(history);

  // Agent 지침 전달 여부 결정 (동일 Agent면 중복 전달 안함)
  const currentAgentName = agentInstructions?.name;
  const shouldPassInstructions = ChatSessionManager.shouldPassAgentInstructions(history, currentAgentName);
  const effectiveAgentInstructions = shouldPassInstructions ? agentInstructions : undefined;

  // AbortController 생성 (취소 토큰 연동)
  const abortController = new AbortController();
  const cancelDisposable = token.onCancellationRequested(() => abortController.abort());

  // #file:~ 참조를 실제 파일 경로로 치환
  const resolvedPrompt = resolveFileReferences(prompt, references);

  // CLI 실행 (스트리밍)
  const result = await cliRunner.run(
    {
      prompt: resolvedPrompt,
      agentInstructions: effectiveAgentInstructions,
      abortSignal: abortController.signal,
      resumeSessionId: existingSessionId,
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    },
    (content) => handleStreamContent(stream, content)
  );

  // 새 세션 ID가 있고 기존 세션이 없을 경우, 다음 대화에서 찾을 수 있도록 마커 삽입
  if (result.sessionId && !existingSessionId) {
    ChatSessionManager.saveSessionId(stream, result.sessionId);
  }

  // Agent 이름이 변경되었으면 마커 저장 (다음 대화에서 중복 전달 방지)
  if (currentAgentName && shouldPassInstructions) {
    ChatSessionManager.saveAgentName(stream, currentAgentName);
  }

  // 이벤트 리스너 정리
  cancelDisposable.dispose();

  if (!result.success && result.error) {
    stream.markdown(`\n\n---\n⚠️ **Error:** ${result.error}`);
    return false;
  }

  return true;
}
