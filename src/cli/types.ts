/**
 * CLI 관련 타입 정의
 */

import { ModeInstructions } from "../participants/types";

/**
 * CLI 실행 옵션
 */
export interface CliOptions {
  /** 모드 지침 */
  modeInstructions?: ModeInstructions;
  /** 프롬프트 내용 */
  prompt: string;
  /** 취소 토큰 */
  abortSignal?: AbortSignal;
  /** 재개할 CLI 세션 ID (resume 용도) */
  resumeSessionId?: string;
}

/**
 * 스트리밍 콘텐츠 타입
 */
export type StreamContentType = 'text' | 'tool_use' | 'tool_result';

/**
 * 스트리밍 콘텐츠
 */
export interface StreamContent {
  /** 콘텐츠 타입 */
  type: StreamContentType;
  /** 콘텐츠 내용 */
  content: string;
  /** 도구 이름 (tool_use 타입일 경우) */
  toolName?: string;
}

/**
 * 스트리밍 콜백 함수 타입
 * @param content - 스트리밍된 콘텐츠
 */
export type StreamCallback = (content: StreamContent) => void;

/**
 * CLI 실행 결과
 */
export interface CliResult {
  /** 성공 여부 */
  success: boolean;
  /** 전체 응답 내용 */
  content: string;
  /** 에러 메시지 (실패 시) */
  error?: string;
  /** CLI 세션 ID (세션 재활용 용도) */
  sessionId?: string;
}

/**
 * Gemini stream-json 메시지 타입
 */
export interface GeminiStreamMessage {
  type: 'init' | 'message' | 'result' | 'tool_use' | 'tool_result';
  timestamp?: string;
  session_id?: string;
  model?: string;
  role?: 'user' | 'assistant';
  content?: string;
  delta?: boolean;
  status?: 'success' | 'error';
  /** tool_use 타입일 때 도구 이름 */
  tool_name?: string;
  /** tool_use/tool_result 타입일 때 도구 ID */
  tool_id?: string;
  /** tool_use 타입일 때 파라미터 */
  parameters?: Record<string, unknown>;
  /** tool_result 타입일 때 결과 */
  output?: string;
  stats?: {
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
    duration_ms?: number;
  };
}

/**
 * Claude stream-json 메시지 타입
 */
export interface ClaudeStreamMessage {
  type: 'system' | 'assistant' | 'result';
  subtype?: 'init' | 'success' | 'error';
  session_id?: string;
  message?: {
    model?: string;
    role?: string;
    content?: Array<{
      type: 'text' | 'tool_use' | 'tool_result';
      text?: string;
      name?: string;
      content?: string;
    }>;
    stop_reason?: string;
  };
  result?: string;
  is_error?: boolean;
  duration_ms?: number;
  total_cost_usd?: number;
}

/**
 * Codex JSONL 이벤트 타입
 * @see https://github.com/openai/codex
 */
export type CodexEventType =
  | 'thread.started'
  | 'turn.started'
  | 'turn.completed'
  | 'item.started'
  | 'item.completed';

/**
 * Codex item 타입
 */
export type CodexItemType =
  | 'reasoning'
  | 'command_execution'
  | 'agent_message'
  | 'mcp_tool_call';

/**
 * Codex item 구조
 */
export interface CodexItem {
  /** 아이템 ID */
  id?: string;
  /** 아이템 타입 */
  type: CodexItemType;
  /** 텍스트 내용 (reasoning, agent_message) */
  text?: string;
  /** 실행된 명령어 (command_execution) */
  command?: string;
  /** 명령어 출력 (command_execution) */
  aggregated_output?: string;
  /** 종료 코드 (command_execution) */
  exit_code?: number | null;
  /** 상태 */
  status?: 'in_progress' | 'completed' | 'failed';
  /** MCP 도구 이름 (mcp_tool_call) */
  tool?: string;
  /** MCP 서버 이름 (mcp_tool_call) */
  server?: string;
}

/**
 * Codex JSONL 스트림 메시지
 */
export interface CodexStreamMessage {
  /** 이벤트 타입 */
  type: CodexEventType;
  /** 스레드(세션) ID - thread.started에서 제공 */
  thread_id?: string;
  /** 아이템 정보 - item.started, item.completed에서 제공 */
  item?: CodexItem;
  /** 사용량 정보 - turn.completed에서 제공 */
  usage?: {
    input_tokens?: number;
    cached_input_tokens?: number;
    output_tokens?: number;
  };
}

/**
 * CLI 설치 상태
 */
export type InstallStatus = 'installed' | 'not_installed' | 'unknown';

/**
 * CLI 설치 정보
 */
export interface InstallInfo {
  /** 설치 상태 */
  status: InstallStatus;
  /** CLI 버전 */
  version?: string;
  /** CLI 실행 파일 경로 */
  path?: string;
  /** 에러 메시지 */
  error?: string;
}

/**
 * CLI 상태 정보
 */
export interface CliHealthStatus {
  /** CLI 이름 */
  cli: string;
  /** 설치 정보 */
  install: InstallInfo;
  /** 검사 시각 */
  checkedAt: Date;
}

/**
 * 해결 가이드
 */
export interface HealthGuidance {
  /** 가이드 제목 */
  title: string;
  /** 해결 단계 */
  steps: string[];
  /** 관련 링크 */
  links?: Array<{ label: string; url: string }>;
}

/**
 * Doctor 검증 결과
 */
export interface DoctorResult {
  /** 상태 정보 */
  status: CliHealthStatus;
  /** 설치 가이드 */
  installGuidance: HealthGuidance;
}

/**
 * CLI Runner 인터페이스
 */
export interface CliRunner {
  /** CLI 이름 */
  readonly name: string;
  
  /**
   * CLI 실행 (스트리밍)
   * @param options - 실행 옵션
   * @param onContent - 콘텐츠 스트리밍 콜백
   * @returns 실행 결과
   */
  run(options: CliOptions, onContent: StreamCallback): Promise<CliResult>;

  getArgumentOutputFormat(): string[];

  getArgumentAllowedTools(): string[];

  getArgumentModel(): string[];

  getArgumentResume(sessionId?: string): string[];

  getArgumentDirectories(): string[];

  getArgumentPrompt(options: { modeInstructions?: ModeInstructions; prompt?: string }): string[];

  checkInstallation(): Promise<InstallInfo>;

  getInstallGuidance(): HealthGuidance;
}
