/**
 * Chat Participant 관련 타입 정의
 */

import * as vscode from 'vscode';
import type { CliRunner } from '../cli';

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
