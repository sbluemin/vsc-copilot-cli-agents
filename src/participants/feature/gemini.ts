/**
 * Gemini CLI Participant
 */

import * as vscode from 'vscode';
import { SpawnCliRunner, ParseResult } from '../../cli/spawnCliRunner';
import { GeminiStreamMessage, StreamContent, InstallInfo, HealthGuidance } from '../../cli/types';
import { executeCommand } from '../../cli/utils/commandExecutor';
import { ParticipantConfig } from '../types';

export class GeminiCliRunner extends SpawnCliRunner {
  readonly name = 'gemini';

  protected buildCliOptions(resumeSessionId?: string): { command: string; args: string[] } {
    const config = vscode.workspace.getConfiguration('CCA');
    const command = 'gemini';
    const args = ['--output-format', 'stream-json'];

    const allowedTools = ['glob', 'google_web_search', 'read_file', 'list_directory', 'search_file_content'];
    args.push('--allowed-tools', allowedTools.join(','));

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

    const model = config.get<string>('gemini.model');
    if (model) {
      args.push('--model', model);
    }

    // 세션 재개 옵션 추가
    if (resumeSessionId) {
      args.push('--resume', resumeSessionId);
    }

    return {
      command,
      args,
    };
  }

  protected buildPromptArgument(prompt: string): string[] {
    // gemini는 prompt를 그대로 첫 번째 인자로 전달
    return [prompt];
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

  protected async checkInstallation(): Promise<InstallInfo> {
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

  protected getInstallGuidance(): HealthGuidance {
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

