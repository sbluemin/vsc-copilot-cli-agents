/**
 * Commands 관련 타입 정의
 */

import * as vscode from 'vscode';

/**
 * 커맨드 설정
 */
export interface CommandConfig {
  /** 커맨드 ID (package.json에 정의된 것과 일치해야 함) */
  id: string;
  /** 커맨드 실행 함수 */
  handler: (...args: unknown[]) => Promise<void> | void;
}
