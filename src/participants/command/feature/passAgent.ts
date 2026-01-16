/**
 * /passAgent 커맨드 구현
 * Custom Agent의 modeInstructions를 CLI에 전달합니다.
 */

import * as vscode from 'vscode';
import { ParticipantCommand, CommandContext } from '../types';
import { runCliWithStreaming } from '../../handler';
import { resolveFileReferencesInText } from '../../../cli/utils';

/**
 * 확장된 ChatRequest 인터페이스
 * VS Code의 modeInstructions 속성 지원 (proposed API 또는 확장)
 */
interface ExtendedChatRequest extends vscode.ChatRequest {
  /** 모드 지침 (커스텀 에이전트 설정 등) */
  readonly modeInstructions?: string;
  /** 추가 모드 지침 */
  readonly modeInstructions2?: {
    name: string;
    content: string;
  };
}

/**
 * modeInstructions 추출 및 조합
 * @param request - 확장된 ChatRequest
 * @returns 조합된 시스템 프롬프트 또는 undefined
 */
function extractModeInstructions(request: ExtendedChatRequest): string | undefined {
  const parts: string[] = [];

  if (request.modeInstructions) {
    parts.push(request.modeInstructions);
  }

  if (request.modeInstructions2?.content) {
    parts.push(request.modeInstructions2.content);
  }

  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

/**
 * passAgent 커맨드 핸들러
 * Custom Agent의 modeInstructions를 CLI에 전달
 * @param ctx - 커맨드 컨텍스트
 * @returns 커맨드 처리 완료 여부
 */
async function handlePassAgent(ctx: CommandContext): Promise<boolean> {
  const { request, context, stream, token, config } = ctx;
  const { cliRunner, name } = config;
  const extendedRequest = request as ExtendedChatRequest;

  // modeInstructions 추출 및 #file:~ 참조 치환
  let systemPrompt = extractModeInstructions(extendedRequest);
  if (systemPrompt) {
    systemPrompt = resolveFileReferencesInText(systemPrompt, request.references);
  }

  // 공통 CLI 실행 로직 사용
  await runCliWithStreaming({
    cliRunner,
    name,
    prompt: request.prompt,
    references: request.references,
    history: context.history,
    stream,
    token,
    systemPrompt,
    commandName: 'passAgent',
  });

  return true;
}

/**
 * passAgent 커맨드 설정
 */
export const passAgentCommand: ParticipantCommand = {
  name: 'passAgent',
  description: 'Pass Custom Agent mode instructions to CLI and execute',
  handler: handlePassAgent,
};

