/**
 * Chat Participant 관련 타입 정의
 */

import * as vscode from 'vscode';
import type { CliRunner, AgentInstructions } from '../cli';

// AgentInstructions를 re-export (하위 호환성)
export type { AgentInstructions };

/**
 * Chat Participant 설정
 */
export interface ParticipantConfig {
  /** Participant ID (package.json에 정의된 것과 일치해야 함) */
  id: string;
  /** 표시 이름 */
  name: string;
  /** 설명 */
  description: string;
  /** CLI Runner */
  cliRunner: CliRunner;
  /** 아이콘 경로 (터미널 등에서 사용) */
  iconPath?: vscode.Uri;
}

/**
 * Chat Participant 핸들러 컨텍스트
 */
export interface ParticipantContext {
  /** VS Code Extension Context */
  extensionContext: vscode.ExtensionContext;
  /** 설정 */
  config: ParticipantConfig;
}

/*
 * 확장된 ChatRequest 인터페이스
 * VS Code의 Custom Agent 기능을 위한 proposed API 속성 지원
 * @see https://code.visualstudio.com/api/extension-guides/chat
 * 
 * agentInstructions는 GitHub Copilot의 Custom Agent 모드에서 제공되는
 * 시스템 프롬프트로, 외부 CLI 모델에 전달하여 Custom Agent의 동작을
 * 재현할 수 있습니다.
 */
export interface ExtendedChatRequest extends vscode.ChatRequest {
  /** 에이전트 지침 (커스텀 에이전트 설정 등) - Proposed API */
  readonly modeInstructions?: string;
  /** 추가 에이전트 지침 - Proposed API */
  readonly modeInstructions2?: AgentInstructions;
}