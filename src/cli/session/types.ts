/**
 * 세션 관리 관련 타입 정의
 */

/**
 * CLI 세션 정보
 */
export interface CliSessionInfo {
  /** CLI 세션 ID */
  cliSessionId: string;
  /** 생성 시간 (ISO 8601) */
  createdAt: string;
  /** 마지막 사용 시간 (ISO 8601) */
  lastUsedAt: string;
}

/**
 * 코파일럿 세션 매핑
 * key: VSCode Copilot Session ID
 * value: CLI별 세션 정보
 */
export interface CopilotSessionMapping {
  /** Gemini CLI 세션 */
  gemini?: CliSessionInfo;
  /** Claude CLI 세션 */
  claude?: CliSessionInfo;
}

/**
 * 세션 저장소 데이터 구조
 */
export interface SessionStoreData {
  /** 버전 (향후 마이그레이션 용도) */
  version: number;
  /** 세션 매핑 (key: Copilot Session ID) */
  sessions: Record<string, CopilotSessionMapping>;
}

/**
 * 지원하는 CLI 타입
 */
export type CliType = 'gemini' | 'claude';
