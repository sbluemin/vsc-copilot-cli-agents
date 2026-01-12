/**
 * Claude CLI Participant
 */

import * as vscode from 'vscode';
import { SpawnCliRunner, ParseResult } from '../../cli/spawnCliRunner';
import { ClaudeStreamMessage, StreamContent, InstallInfo, HealthGuidance } from '../../cli/types';
import { executeCommand } from '../../cli/utils/commandExecutor';
import { ParticipantConfig } from '../types';

export class ClaudeCliRunner extends SpawnCliRunner {
  readonly name = 'claude';

  protected buildCliOptions(resumeSessionId?: string): { command: string; args: string[] } {
    const config = vscode.workspace.getConfiguration('CCA');
    const model = config.get<string>('claude.model');
    const workspaceFolders = vscode.workspace.workspaceFolders;

    const args = ['--allowed-tools', 'WebSearch', '--output-format', 'stream-json', '--verbose'];

    // 다중 workspace 디렉토리 추가
    if (workspaceFolders && workspaceFolders.length > 0) {
      for (const folder of workspaceFolders) {
        args.push('--add-dir', folder.uri.fsPath);
      }
    }

    if (model) {
      args.push('--model', model);
    }

    // 세션 재개 옵션 추가
    if (resumeSessionId) {
      args.push('--resume', resumeSessionId);
    }

    return {
      command: 'claude',
      args,
    };
  }

  protected buildPromptArgument(prompt: string): string[] {
    // claude는 -p <prompt> 형태로 전달
    return ['-p', prompt];
  }

  protected parseLineWithSession(line: string): ParseResult {
    try {
      const message = JSON.parse(line) as ClaudeStreamMessage;
      let content: StreamContent | null = null;

      if (message.type === 'assistant' && message.message?.content) {
        for (const item of message.message.content) {
          // tool_use 타입 처리
          if (item.type === 'tool_use') {
            content = {
              type: 'tool_use',
              content: item.name || 'tool',
              toolName: item.name,
            };
            break;
          }

          // tool_result 타입 처리
          if (item.type === 'tool_result') {
            content = {
              type: 'tool_result',
              content: item.content || '',
              toolName: item.name,
            };
            break;
          }
          
          // text 타입 처리
          if (item.type === 'text' && item.text) {
            content = {
              type: 'text',
              content: item.text,
            };
            break;
          }
        }
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
      const pathOutput = await executeCommand(whichCmd, ['claude'], 10000);
      const cliPath = pathOutput
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0)[0];

      // 버전 확인 (spawn으로 안전하게 실행)
      const versionOutput = await executeCommand('claude', ['--version'], 10000);
      const version = versionOutput.trim();

      return {
        status: 'installed',
        version,
        path: cliPath,
      };
    } catch (error: unknown) {
      let errorMessage = 'Claude CLI not found in PATH';

      if (error && typeof error === 'object') {
        const err = error as { code?: string; signal?: string; message?: string; killed?: boolean };

        // 다양한 오류 유형 감지
        if (err.code === 'ETIMEDOUT' || (err.killed && err.signal === 'SIGTERM')) {
          errorMessage = 'Timed out while checking Claude CLI installation';
        } else if (err.code === 'ENOENT') {
          errorMessage = 'Claude CLI executable not found. Ensure it is installed and on your PATH.';
        } else if (err.code === 'EACCES') {
          errorMessage = 'Permission denied while executing Claude CLI. Check executable permissions.';
        } else if (err.message && err.message.trim() !== '') {
          errorMessage = `Failed to verify Claude CLI installation: ${err.message}`;
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
        'Visit the official installation page',
        'Follow the installation instructions for your platform',
        'After installation, run `@claude /doctor` again to verify',
      ],
      links: [
        {
          label: 'Claude CLI Installation Guide',
          url: 'https://claude.com/product/claude-code',
        },
      ],
    };
  }
}

/**
 * Claude CLI Runner 싱글톤 인스턴스
 */
const claudeCli = new ClaudeCliRunner();

/**
 * Claude Participant 설정 생성
 * @returns Participant 설정
 */
export function createClaudeParticipant(): ParticipantConfig {
  return {
    id: 'copilot-cli-agents.claude',
    name: 'Claude',
    description: 'Anthropic Claude AI Assistant',
    cliRunner: claudeCli,
  };
}

