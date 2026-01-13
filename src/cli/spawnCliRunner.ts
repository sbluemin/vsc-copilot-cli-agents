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

  /**
   * CLI 실행 옵션 빌드
   * @param resumeSessionId - 재개할 세션 ID (선택적)
   * @returns CLI 명령어와 추가 인자
   */
  protected abstract buildCliOptions(resumeSessionId?: string): { command: string; args: string[] };

  /**
   * 프롬프트 인자 빌드
   * @param prompt - 프롬프트 내용
   * @returns 프롬프트를 CLI 인자 형태로 반환
   */
  protected abstract buildPromptArgument(prompt: string): string[];

  /**
   * 스트리밍 라인 파싱 (세션 ID 추출 포함)
   * @param line - JSON 라인
   * @returns 파싱 결과 (콘텐츠 및 세션 ID)
   */
  protected abstract parseLineWithSession(line: string): ParseResult;

  /**
   * CLI 설치 상태 확인
   * @returns 설치 정보
   */
  protected abstract checkInstallation(): Promise<InstallInfo>;

  /**
   * 설치 가이드 반환
   * @returns 설치 가이드
   */
  protected abstract getInstallGuidance(): HealthGuidance;

  /**
   * ANSI escape 코드 제거
   */
  private cleanAnsi(text: string): string {
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  }

  /**
   * 데이터 청크 처리 (stdout/stderr 공통)
   */
  private processChunk(chunk: Buffer, context: ProcessContext): void {
    context.buffer.value += chunk.toString();
    const lines = context.buffer.value.split('\n');
    // 마지막 불완전한 라인은 버퍼에 유지
    context.buffer.value = lines.pop() || '';

    for (const line of lines) {
      const cleanLine = this.cleanAnsi(line).trim();
      if (!cleanLine) {
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

    if (exitCode === 0) {
      context.resolve({
        success: true,
        content: context.fullContent.value,
        sessionId: context.extractedSessionId.value,
      });
    } else {
      context.resolve({
        success: false,
        content: context.fullContent.value,
        error: `Process exited with code ${exitCode}`,
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

    // stderr도 함께 처리 (일부 CLI는 stderr로 출력)
    childProcess.stderr?.on('data', (chunk: Buffer) => {
      this.processChunk(chunk, context);
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
    const { prompt, abortSignal, resumeSessionId } = options;
    const { command, args } = this.buildCliOptions(resumeSessionId);
    const promptArgs = this.buildPromptArgument(prompt);

    // 프롬프트 인자에 셸 이스케이프 적용 (줄바꿈 등 특수문자 처리)
    const escapedPromptArgs = promptArgs.map((arg) => this.escapeShellArg(arg));

    // 전체 인자 조합: escapedPromptArgs + args
    const allArgs = [...escapedPromptArgs, ...args];

    return new Promise((resolve) => {
      const childProcess: ChildProcess = spawn(command, allArgs, {
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
        env: process.env,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // 프로세스 컨텍스트 생성
      const context: ProcessContext = {
        fullContent: { value: '' },
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

  /**
   * CLI 상태 검증 실행
   * @returns Doctor 검증 결과
   */
  async doctor(): Promise<DoctorResult> {
    const install = await this.checkInstallation();

    const status: CliHealthStatus = {
      cli: this.name,
      install,
      checkedAt: new Date(),
    };

    return {
      status,
      installGuidance: this.getInstallGuidance(),
    };
  }
}
