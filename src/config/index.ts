/**
 * VS Code 설정 관리 유틸리티
 */

import * as vscode from 'vscode';

/**
 * CLI 설정 인터페이스
 */
export interface CliConfig {
  /** 사용할 모델 */
  model?: string;
  /** 커스텀 모델명 */
  customModel?: string;
  /** CLI 실행 경로 */
  cliPath?: string;
}

/**
 * Claude CLI 설정 조회
 * @returns Claude CLI 설정
 */
export function getClaudeConfig(): CliConfig {
  const config = vscode.workspace.getConfiguration('copilot-cli-agents.claude');
  return {
    model: config.get<string>('customModel') || config.get<string>('model'),
    cliPath: config.get<string>('cliPath'),
  };
}

/**
 * Gemini CLI 설정 조회
 * @returns Gemini CLI 설정
 */
export function getGeminiConfig(): CliConfig {
  const config = vscode.workspace.getConfiguration('copilot-cli-agents.gemini');
  return {
    model: config.get<string>('model'),
    cliPath: config.get<string>('cliPath'),
  };
}

/**
 * 전역 설정 조회
 * @returns 전역 설정
 */
export function getGlobalConfig() {
  const config = vscode.workspace.getConfiguration('copilot-cli-agents');
  return {
    timeout: config.get<number>('timeout', 120000),
  };
}
