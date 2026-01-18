/**
 * Claude CLI Participant
 */

import * as vscode from 'vscode';
import { SpawnCliRunner, ParseResult } from '../../cli/spawnCliRunner';
import { ClaudeStreamMessage, StreamContent, InstallInfo, HealthGuidance } from '../../cli/types';
import { executeCommand } from '../../cli/spawnCliRunner';
import { ModeInstructions, ParticipantConfig } from '../types';

export class ClaudeCliRunner extends SpawnCliRunner {
  readonly name = 'claude';

  getArgumentOutputFormat(): string[] {
    return ['--output-format', 'stream-json', '--verbose', '--include-partial-messages'];
  }

  getArgumentAllowedTools(): string[] {
    const config = vscode.workspace.getConfiguration('CCA');
    const allowedTools = config.get<string[]>('claude.allowedTools', []);
    return allowedTools.length > 0 ? ['--allowed-tools', allowedTools.join(',')] : [];
  }

  getArgumentModel(): string[] {
    const config = vscode.workspace.getConfiguration('CCA');
    const model = config.get<string>('claude.model');
    return model ? ['--model', model] : [];
  }

  getArgumentResume(sessionId?: string): string[] {
    return sessionId ? ['--resume', sessionId] : [];
  }

  getArgumentDirectories(): string[] {
    const args: string[] = [];
    // 다중 workspace 디렉토리 추가
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      for (const folder of workspaceFolders) {
        args.push('--add-dir', folder.uri.fsPath);
      }
    }
    return args;
  }

  getArgumentPrompt(options: { modeInstructions?: ModeInstructions; prompt?: string }): string[] {
    const { modeInstructions, prompt } = options;
    const args = [];

    // modeInstructions가 있으면 JSON 형태로 agents 설정 추가
    if (modeInstructions) {
      const agentsConfig = JSON.stringify({
        [modeInstructions.name]: {
          description: `${modeInstructions.name} agent`,
          prompt: modeInstructions.content
        }
      });

      args.push('--agent', `'${modeInstructions.name}'`, '--agents', `'${agentsConfig}'`);
    }

    // claude는 -p <prompt> 형태로 전달
    if (prompt) {
      args.push('-p', prompt);
    }

    return args;
  }

  async checkInstallation(): Promise<InstallInfo> {
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

  getInstallGuidance(): HealthGuidance {
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
      command: 'claude',
      args,
    };
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

