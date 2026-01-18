/**
 * Spawn 기반 CLI Runner
 *
 * child_process.spawn을 사용하여 크로스 플랫폼에서 CLI를 실행합니다.
 * shell: true 옵션으로 Windows의 .cmd 래퍼와 Unix 셸 스크립트를 모두 지원합니다.
 */

import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import {
  CliOptions,
  CliResult,
  StreamCallback,
  StreamContent,
  CliRunner,
  DoctorResult,
  InstallInfo,
  HealthGuidance,
  CliHealthStatus,
} from './types';
import { ModeInstructions } from '../participants/types';

/**
 * Windows 경로의 드라이브 문자를 대문자로 정규화
 * 예: c:\path -> C:\path
 * @param path - 정규화할 경로
 * @returns 드라이브 문자가 대문자로 정규화된 경로
 */
export function normalizeWindowsDriveLetter(path: string): string {
  if (process.platform === 'win32') {
    return path.replace(/^([a-z]):/, (_, letter) => letter.toUpperCase() + ':');
  }
  return path;
}

/**
 * spawn을 사용하여 명령을 안전하게 실행
 * @param command - 실행할 명령어
 * @param args - 명령어 인자 배열
 * @param timeoutMs - 타임아웃 (밀리초)
 * @returns stdout 출력
 */
export function executeCommand(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, { shell: true });
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      childProcess.kill('SIGTERM');
      reject(new Error('Command execution timed out'));
    }, timeoutMs);

    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    childProcess.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    childProcess.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Command exited with code ${code}`));
      }
    });
  });
}

/**
 * 스트리밍 파싱 결과 (세션 ID 포함)
 */
export interface ParseResult {
  /** 스트리밍 콘텐츠 */
  content: StreamContent | null;
  /** 추출된 세션 ID (있는 경우) */
  sessionId?: string;
}

/**
 * 프로세스 실행 컨텍스트
 * 스트리밍 상태와 콜백을 관리하는 컨텍스트 객체
 */
interface ProcessContext {
  /** 전체 누적 콘텐츠 */
  fullContent: { value: string };
  /** stderr 누적 콘텐츠 (에러 로깅용) */
  stderrContent: { value: string };
  /** stderr 라인 버퍼 */
  stderrBuffer: { value: string };
  /** 라인 버퍼 */
  buffer: { value: string };
  /** 추출된 세션 ID */
  extractedSessionId: { value?: string };
  /** 스트리밍 콜백 */
  onContent: StreamCallback;
  /** abort 시그널 */
  abortSignal?: AbortSignal;
  /** abort 핸들러 */
  abortHandler: () => void;
  /** Promise resolve 함수 */
  resolve: (result: CliResult) => void;
}

/**
 * Spawn 기반 CLI Runner 추상 클래스
 */
export abstract class SpawnCliRunner implements CliRunner {
  abstract readonly name: string;

  abstract getArgumentOutputFormat(): string[];

  abstract getArgumentAllowedTools(): string[];

  abstract getArgumentModel(): string[];

  abstract getArgumentResume(sessionId?: string): string[];

  abstract getArgumentDirectories(): string[];

  abstract getArgumentPrompt(options: { 
    modeInstructions?: ModeInstructions; 
    prompt?: string 
  }): string[];

  /**
   * CLI 설치 상태 확인
   * @returns 설치 정보
   */
  abstract checkInstallation(): Promise<InstallInfo>;

  /**
   * 설치 가이드 반환
   * @returns 설치 가이드
   */
  abstract getInstallGuidance(): HealthGuidance;

  /**
   * CLI 실행 옵션 빌드
   * @param options - 옵션 객체
   * @returns CLI 명령어와 추가 인자
   */
  protected abstract buildCliOptions(options?: {
    resumeSessionId?: string;
    modeInstructions?: ModeInstructions;
    prompt?: string;
  }): { command: string; args: string[] };

  /**
   * 스트리밍 라인 파싱 (세션 ID 추출 포함)
   * @param line - JSON 라인
   * @returns 파싱 결과 (콘텐츠 및 세션 ID)
   */
  protected abstract parseLineWithSession(line: string): ParseResult;

  /**
   * ANSI escape 코드 제거
   */
  private cleanAnsi(text: string): string {
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  }

  /**
   * JSON 라인 여부 판단
   */
  private isLikelyJsonLine(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
  }

  /**
   * 데이터 청크 처리 (버퍼 분리)
   */
  private processChunkWithBuffer(
    chunk: Buffer,
    buffer: { value: string },
    context: ProcessContext,
    parseJsonOnly: boolean
  ): void {
    buffer.value += chunk.toString();
    const lines = buffer.value.split('\n');
    // 마지막 불완전한 라인은 버퍼에 유지
    buffer.value = lines.pop() || '';

    for (const line of lines) {
      const cleanLine = this.cleanAnsi(line).trim();
      if (!cleanLine) {
        continue;
      }
      if (parseJsonOnly && !this.isLikelyJsonLine(cleanLine)) {
        continue;
      }

      const parseResult = this.parseLineWithSession(cleanLine);

      // 세션 ID 추출
      if (parseResult.sessionId && !context.extractedSessionId.value) {
        context.extractedSessionId.value = parseResult.sessionId;
      }

      if (parseResult.content) {
        if (parseResult.content.type === 'text') {
          context.fullContent.value += parseResult.content.content;
        }
        context.onContent(parseResult.content);
      }
    }
  }

  /**
   * 데이터 청크 처리 (stdout)
   */
  private processChunk(chunk: Buffer, context: ProcessContext): void {
    this.processChunkWithBuffer(chunk, context.buffer, context, false);
  }

  /**
   * 데이터 청크 처리 (stderr)
   */
  private processStderrChunk(chunk: Buffer, context: ProcessContext): void {
    this.processChunkWithBuffer(chunk, context.stderrBuffer, context, true);
  }

  /**
   * 남은 버퍼 처리
   */
  private processRemainingBuffer(context: ProcessContext): void {
    if (!context.buffer.value.trim()) {
      return;
    }

    const cleanLine = this.cleanAnsi(context.buffer.value).trim();
    const parseResult = this.parseLineWithSession(cleanLine);

    // 세션 ID 추출
    if (parseResult.sessionId && !context.extractedSessionId.value) {
      context.extractedSessionId.value = parseResult.sessionId;
    }

    if (parseResult.content) {
      if (parseResult.content.type === 'text') {
        context.fullContent.value += parseResult.content.content;
      }
      context.onContent(parseResult.content);
    }
  }

  /**
   * abort 이벤트 리스너 정리
   */
  private cleanupAbortListener(context: ProcessContext): void {
    if (context.abortSignal) {
      context.abortSignal.removeEventListener('abort', context.abortHandler);
    }
  }

  /**
   * 프로세스 종료 핸들러
   */
  private handleProcessClose(exitCode: number | null, context: ProcessContext): void {
    this.cleanupAbortListener(context);
    this.processRemainingBuffer(context);

    if (process.env.COPILOT_CLI_AGENTS_DEBUG === '1' || process.env.COPILOT_CLI_AGENTS_DEBUG === 'true') {
      console.log('[CLI Debug] Process exited with code:', exitCode);
      console.log('[CLI Debug] Full content length:', context.fullContent.value.length);
      console.log('[CLI Debug] Content preview:', context.fullContent.value.substring(0, 200));
      if (context.stderrContent.value) {
        console.error('[CLI Debug] stderr content:', context.stderrContent.value);
      }
    }

    if (exitCode === 0) {
      context.resolve({
        success: true,
        content: context.fullContent.value,
        sessionId: context.extractedSessionId.value,
      });
    } else {
      if (process.env.COPILOT_CLI_AGENTS_DEBUG === '1' || process.env.COPILOT_CLI_AGENTS_DEBUG === 'true') {
        console.error('[CLI Error] Process failed with exit code:', exitCode);
      }
      const errorDetails = context.stderrContent.value 
        ? `\nStderr: ${context.stderrContent.value}`
        : '';
      context.resolve({
        success: false,
        content: context.fullContent.value,
        error: `Process exited with code ${exitCode}${errorDetails}`,
        sessionId: context.extractedSessionId.value,
      });
    }
  }

  /**
   * 프로세스 에러 핸들러
   */
  private handleProcessError(err: Error, context: ProcessContext): void {
    this.cleanupAbortListener(context);

    context.resolve({
      success: false,
      content: context.fullContent.value,
      error: err.message,
      sessionId: context.extractedSessionId.value,
    });
  }

  /**
   * 프로세스 이벤트 핸들러 등록
   */
  private registerProcessHandlers(childProcess: ChildProcess, context: ProcessContext): void {
    // abort 시그널 처리
    if (context.abortSignal) {
      context.abortSignal.addEventListener('abort', context.abortHandler);
    }

    // stdout 스트리밍 처리
    childProcess.stdout?.on('data', (chunk: Buffer) => {
      this.processChunk(chunk, context);
    });

    // stderr 별도 처리 (에러 메시지 캡처)
    childProcess.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      context.stderrContent.value += text;
      if (process.env.COPILOT_CLI_AGENTS_DEBUG === '1' || process.env.COPILOT_CLI_AGENTS_DEBUG === 'true') {
        console.error('[CLI stderr]', text);
      }
      // JSON 파싱 시도 (일부 CLI는 stderr로도 JSON 출력)
      this.processStderrChunk(chunk, context);
    });

    // 종료 이벤트 처리
    childProcess.on('close', (exitCode) => {
      this.handleProcessClose(exitCode, context);
    });

    // 에러 이벤트 처리
    childProcess.on('error', (err) => {
      this.handleProcessError(err, context);
    });
  }

  /**
   * 셸 인자 이스케이프 (플랫폼별 처리)
   * shell: true일 때 줄바꿈 및 특수문자가 개별 명령으로 해석되지 않도록 처리
   * @param arg - 이스케이프할 인자
   * @returns 플랫폼에 맞게 이스케이프된 인자
   */
  private escapeShellArg(arg: string): string {
    if (process.platform === 'win32') {
      // Windows: 더블쿼트로 감싸고 내부 더블쿼트, 백슬래시, 특수문자 이스케이프
      // 줄바꿈은 공백으로 치환 (cmd.exe는 줄바꿈을 쿼트 내에서도 명령 구분자로 처리)
      const escaped = arg
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/[\r\n]+/g, ' ');
      return `"${escaped}"`;
    } else {
      // Unix: 싱글쿼트로 감싸면 내부 문자가 그대로 전달됨
      // 단, 싱글쿼트 자체만 이스케이프 필요
      return `'${arg.replace(/'/g, "'\\''")}'`;
    }
  }

  /**
   * CLI 실행 (스트리밍)
   */
  async run(options: CliOptions, onContent: StreamCallback): Promise<CliResult> {
    const { prompt, modeInstructions, abortSignal, resumeSessionId } = options;
    const { command, args } = this.buildCliOptions({ resumeSessionId, modeInstructions, prompt });

    // shell: true 사용 시 모든 인자에 셸 이스케이프 적용 (줄바꿈, 특수문자, 공백 등 처리)
    const allArgs = args.map((arg) => this.escapeShellArg(arg));

    // 디버깅: 실제 실행되는 명령어 로깅 (환경 변수로 활성화)
    if (process.env.COPILOT_CLI_AGENTS_DEBUG === '1' || process.env.COPILOT_CLI_AGENTS_DEBUG === 'true') {
      console.log('[CLI Debug] Command:', command);
      console.log('[CLI Debug] Args (raw):', JSON.stringify(args, null, 2));
      console.log('[CLI Debug] All Args (escaped):', JSON.stringify(allArgs, null, 2));
    }

    return new Promise((resolve) => {
      const workingDir = normalizeWindowsDriveLetter(
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd()
      );
      
      const childProcess: ChildProcess = spawn(command, allArgs, {
        cwd: workingDir,
        env: process.env,
        shell: true, // Windows .cmd 지원 및 PATH 명령어 탐색을 위해 shell: true 유지
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // 프로세스 컨텍스트 생성
      const context: ProcessContext = {
        fullContent: { value: '' },
        stderrContent: { value: '' },
        stderrBuffer: { value: '' },
        buffer: { value: '' },
        extractedSessionId: {},
        onContent,
        abortSignal,
        abortHandler: () => childProcess.kill('SIGTERM'),
        resolve,
      };

      // 이벤트 핸들러 등록
      this.registerProcessHandlers(childProcess, context);
    });
  }
}
