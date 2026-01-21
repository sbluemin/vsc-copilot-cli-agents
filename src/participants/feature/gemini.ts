/**
 * Gemini CLI Participant
 */

import * as vscode from 'vscode';
import { executeCommand, ParseResult, SpawnCliRunner } from '../../cli/spawnCliRunner';
import { GeminiStreamMessage, HealthGuidance, InstallInfo, StreamContent } from '../../cli/types';
import { ModeInstructions, ParticipantConfig } from '../types';

export class GeminiCliRunner extends SpawnCliRunner {
  readonly name = 'gemini';

  getArgumentOutputFormat(): string[] {
    return ['--output-format', 'stream-json'];
  }

  getArgumentAllowedTools(): string[] {
    // Gemini CLI는 기본적으로 웹 검색이 활성화되어 있음
    return [];
  }

  getArgumentModel(): string[] {
    const config = vscode.workspace.getConfiguration('CCA');
    const model = config.get<string>('gemini.model');
    return model ? ['--model', model] : [];
  }
  
  getArgumentResume(sessionId?: string): string[] {
    return sessionId ? ['--resume', sessionId] : [];
  }

  getArgumentDirectories(): string[] {
    // 다중 workspace 디렉토리 추가
    /* #NOT_WORKING: https://github.com/google-gemini/gemini-cli/issues/13669
     * 현재 `비 인터렉티브` 모드에서 해당 옵션이 제대로 동작하지 않음
     * 이슈가 해결되면 아래 코드를 활성화할 것
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      for (const folder of workspaceFolders) {
        args.push('--include-directories', folder.uri.fsPath);
      }
    }
    */

    return [];
  }

  getArgumentPrompt(options: { modeInstructions?: ModeInstructions; prompt?: string }): string[] {
    const { modeInstructions, prompt } = options;

    // Gemini CLI는 --system-prompt 옵션이 없으므로
    // 모드 지침을 사용자 프롬프트 앞에 추가하여 전달
    let finalPrompt = prompt ?? '';

    if (modeInstructions) {
      // 프롬프팅 기법: 명확한 구분자로 모드 지침과 사용자 요청 구분
      finalPrompt = [
        '<ModeInstructions>',
        modeInstructions.name,
        modeInstructions.content,
        '</ModeInstructions>',
        '',
        prompt ?? ''
      ].join('\n');
    }

    // gemini는 prompt를 그대로 첫 번째 인자로 전달
    return [finalPrompt];
  }

  async checkInstallation(): Promise<InstallInfo> {
    try {
      // which/where 명령으로 경로 확인 (spawn으로 안전하게 실행)
      const whichCmd = process.platform === 'win32' ? 'where' : 'which';
      const pathOutput = await executeCommand(whichCmd, ['gemini'], 10000);
      const cliPath = pathOutput
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0)[0];

      // 버전 확인 (spawn으로 안전하게 실행)
      const versionOutput = await executeCommand('gemini', ['--version'], 10000);
      const version = versionOutput.trim();

      return {
        status: 'installed',
        version,
        path: cliPath,
      };
    } catch (error: unknown) {
      let errorMessage = 'Gemini CLI not found in PATH';

      if (error && typeof error === 'object') {
        const err = error as { code?: string; signal?: string; message?: string; killed?: boolean };

        // 다양한 오류 유형 감지
        if (err.code === 'ETIMEDOUT' || (err.killed && err.signal === 'SIGTERM')) {
          errorMessage = 'Timed out while checking Gemini CLI installation';
        } else if (err.code === 'ENOENT') {
          errorMessage = 'Gemini CLI executable not found. Ensure it is installed and on your PATH.';
        } else if (err.code === 'EACCES') {
          errorMessage = 'Permission denied while executing Gemini CLI. Check executable permissions.';
        } else if (err.message && err.message.trim() !== '') {
          errorMessage = `Failed to verify Gemini CLI installation: ${err.message}`;
        }
      }

      return {
        status: 'not_installed',
        error: errorMessage,
      };
    }
  }

  getInstallGuidance(): HealthGuidance {
    return {
      title: 'How to Install',
      steps: [
        'Visit the official GitHub repository',
        'Follow the installation instructions for your platform',
        'After installation, run `@gemini /doctor` again to verify',
      ],
      links: [
        {
          label: 'Gemini CLI Installation Guide',
          url: 'https://geminicli.com/',
        },
      ],
    };
  }

  protected buildCliOptions(options?: {
    resumeSessionId?: string;
    modeInstructions?: ModeInstructions;
    prompt?: string;
  }): { command: string; args: string[] } {
    const { resumeSessionId } = options ?? {};
    const args: string[] = [];

    args.push(...this.getArgumentOutputFormat());
    args.push(...this.getArgumentAllowedTools());
    args.push(...this.getArgumentModel());
    args.push(...this.getArgumentResume(resumeSessionId));
    args.push(...this.getArgumentDirectories());
    args.push(...this.getArgumentPrompt({ modeInstructions: options?.modeInstructions, prompt: options?.prompt }));

    return {
      command: 'gemini',
      args,
    };
  }

  protected parseLineWithSession(line: string): ParseResult {
    try {
      const message = JSON.parse(line) as GeminiStreamMessage;
      let content: StreamContent | null = null;

      // tool_use 타입 처리
      if (message.type === 'tool_use') {
        content = {
          type: 'tool_use',
          content: message.tool_name || 'tool',
          toolName: message.tool_name,
        };
      }

      // tool_result 타입 처리
      else if (message.type === 'tool_result') {
        content = {
          type: 'tool_result',
          content: message.output || '',
          toolName: message.tool_name,
        };
      }

      // assistant 메시지의 content만 추출
      else if (message.type === 'message' && message.role === 'assistant' && message.content) {
        content = {
          type: 'text',
          content: message.content,
        };
      }

      return {
        content,
        sessionId: message.session_id,
      };
    } catch {
      // JSON 파싱 실패 시 무시
      return { content: null };
    }
  }
}

/**
 * Gemini CLI Runner 싱글톤 인스턴스
 */
const geminiCli = new GeminiCliRunner();

/**
 * Gemini Participant 설정 생성
 * @returns Participant 설정
 */
export function createGeminiParticipant(): ParticipantConfig {
  return {
    id: 'copilot-cli-agents.gemini',
    name: 'Gemini',
    description: 'Google Gemini AI Assistant',
    cliRunner: geminiCli,
  };
}

