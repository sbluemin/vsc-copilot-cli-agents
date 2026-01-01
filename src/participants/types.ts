/**
 * Chat Participant 관련 타입 정의
 */

import * as vscode from 'vscode';
import { CliRunner } from '../cli';

/**
 * Chat Participant 설정
 */
export interface ParticipantConfig {
  /** Participant ID */
  id: string;
  /** 표시 이름 */
  name: string;
  /** 설명 */
  description: string;
  /** CLI Runner */
  cliRunner: CliRunner;
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
