/**
 * CLI 관련 타입 정의
 */

/**
 * CLI 실행 옵션
 */
export interface CliOptions {
  /** 프롬프트 내용 */
  prompt: string;
  /** 작업 디렉토리 */
  cwd?: string;
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
}
