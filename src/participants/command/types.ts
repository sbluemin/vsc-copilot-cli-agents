/**
 * Participant Command 관련 타입 정의
 */

import * as vscode from 'vscode';
import type { AgentInstructions, ParticipantConfig } from '../types';

/**
 * Participant Command 핸들러 컨텍스트
 */
export interface CommandContext {
  /** 요청 정보 */
  request: vscode.ChatRequest;
  /** 채팅 컨텍스트 (history 등) */
  context: vscode.ChatContext;
  /** 응답 스트림 */
  stream: vscode.ChatResponseStream;
  /** 취소 토큰 */
  token: vscode.CancellationToken;
  /** 에이전트 지침 (있는 경우) */
  agentInstructions?: AgentInstructions;
  /** 프롬프트 내용 (있는 경우) */
  prompt?: string;
  /** Participant 설정 */
  config: ParticipantConfig;
}

/**
 * Participant Command 핸들러 함수 타입
 * @returns true면 커맨드 처리 완료, false면 다음 핸들러로 전달
 */
export type CommandHandler = (ctx: CommandContext) => Promise<boolean>;

/**
 * Participant Command 설정
 */
export interface ParticipantCommand {
  /** 커맨드 이름 (package.json의 commands와 일치해야 함) */
  name: string;
  /** 커맨드 설명 */
  description: string;
  /** 커맨드 핸들러 */
  handler: CommandHandler;
}