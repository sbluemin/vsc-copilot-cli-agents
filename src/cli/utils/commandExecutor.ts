/**
 * Command Executor 유틸리티
 * 
 * spawn을 사용하여 명령을 안전하게 실행합니다.
 */

import { spawn } from 'child_process';

/**
 * spawn을 사용하여 명령을 안전하게 실행
 * @param command - 실행할 명령어
 * @param args - 명령어 인자 배열
 * @param timeoutMs - 타임아웃 (밀리초)
 * @returns stdout 출력
 */
export function executeCommand(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args);
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      process.kill('SIGTERM');
      reject(new Error('Command execution timed out'));
    }, timeoutMs);

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    process.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Command exited with code ${code}`));
      }
    });
  });
}
