/**
 * Spawn 기반 CLI Runner
 *
 * child_process.spawn을 사용하여 크로스 플랫폼에서 CLI를 실행합니다.
 * shell: true 옵션으로 Windows의 .cmd 래퍼와 Unix 셸 스크립트를 모두 지원합니다.
 */

import { spawn, ChildProcess } from 'child_process';
import { CliOptions, CliResult, StreamCallback, StreamContent, CliRunner } from '../types';

/**
 * Spawn 기반 CLI Runner 추상 클래스
 */
export abstract class SpawnCliRunner implements CliRunner {
  abstract readonly name: string;

  /**
   * CLI 실행 옵션 빌드
   * @returns CLI 명령어와 추가 인자
   */
  protected abstract buildCliOptions(): { command: string; args: string[] };

  /**
   * 프롬프트 인자 빌드
   * @param prompt - 프롬프트 내용
   * @returns 프롬프트를 CLI 인자 형태로 반환
   */
  protected abstract buildPromptArgument(prompt: string): string[];

  /**
   * 스트리밍 라인 파싱
   * @param line - JSON 라인
   * @returns 추출된 콘텐츠 또는 null
   */
  protected abstract parseLine(line: string): StreamContent | null;

  /**
   * ANSI escape 코드 제거
   */
  private cleanAnsi(text: string): string {
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  }

  /**
   * 데이터 청크 처리 (stdout/stderr 공통)
   */
  private processChunk(
    chunk: Buffer,
    buffer: { value: string },
    fullContent: { value: string },
    onContent: StreamCallback
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

      const result = this.parseLine(cleanLine);
      if (result) {
        if (result.type === 'text') {
          fullContent.value += result.content;
        }
        onContent(result);
      }
    }
  }

  /**
   * CLI 실행 (스트리밍)
   */
  async run(options: CliOptions, onContent: StreamCallback): Promise<CliResult> {
    const { prompt, cwd, abortSignal } = options;
    const { command, args } = this.buildCliOptions();
    const promptArgs = this.buildPromptArgument(prompt);

    // 전체 인자 조합: promptArgs + args
    const allArgs = [...promptArgs, ...args];

    return new Promise((resolve) => {
      const fullContent = { value: '' };
      const buffer = { value: '' };

      // shell: true로 실행하면 크로스 플랫폼에서 동작
      // Windows: .cmd, .bat 래퍼 자동 인식
      // Unix: PATH에서 명령어 탐색
      const childProcess: ChildProcess = spawn(command, allArgs, {
        cwd: cwd || process.cwd(),
        env: process.env,
        shell: true,
        // stdio를 pipe로 설정하여 스트리밍 가능하게 함
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // abort 시그널 처리
      const abortHandler = () => {
        childProcess.kill('SIGTERM');
      };
      if (abortSignal) {
        abortSignal.addEventListener('abort', abortHandler);
      }

      // stdout 스트리밍 처리
      childProcess.stdout?.on('data', (chunk: Buffer) => {
        this.processChunk(chunk, buffer, fullContent, onContent);
      });

      // stderr도 함께 처리 (일부 CLI는 stderr로 출력)
      childProcess.stderr?.on('data', (chunk: Buffer) => {
        this.processChunk(chunk, buffer, fullContent, onContent);
      });

      childProcess.on('close', (exitCode) => {
        // abort 이벤트 리스너 정리
        if (abortSignal) {
          abortSignal.removeEventListener('abort', abortHandler);
        }

        // 남은 버퍼 처리
        if (buffer.value.trim()) {
          const cleanLine = this.cleanAnsi(buffer.value).trim();
          const result = this.parseLine(cleanLine);
          if (result) {
            if (result.type === 'text') {
              fullContent.value += result.content;
            }
            onContent(result);
          }
        }

        if (exitCode === 0) {
          resolve({
            success: true,
            content: fullContent.value,
          });
        } else {
          resolve({
            success: false,
            content: fullContent.value,
            error: `Process exited with code ${exitCode}`,
          });
        }
      });

      childProcess.on('error', (err) => {
        // abort 이벤트 리스너 정리
        if (abortSignal) {
          abortSignal.removeEventListener('abort', abortHandler);
        }

        resolve({
          success: false,
          content: fullContent.value,
          error: err.message,
        });
      });
    });
  }
}
