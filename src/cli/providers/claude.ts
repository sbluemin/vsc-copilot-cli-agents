/**
 * Claude CLI Provider
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { SpawnCliRunner, ParseResult } from '../runners';
import { ClaudeStreamMessage, StreamContent, InstallInfo, HealthGuidance } from '../types';

const execAsync = promisify(exec);

export class ClaudeCliRunner extends SpawnCliRunner {
  readonly name = 'claude';

  protected buildCliOptions(resumeSessionId?: string): { command: string; args: string[] } {
    const config = vscode.workspace.getConfiguration('copilot-cli-agents');
    const model = config.get<string>('claude.model');

    const args = ['--allowed-tools', 'WebSearch', '--output-format', 'stream-json', '--verbose'];

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
      // which/where 명령으로 경로 확인
      const whichCmd = process.platform === 'win32' ? 'where' : 'which';
      const { stdout: pathOutput } = await execAsync(`${whichCmd} claude`, { timeout: 10000 });
      const cliPath = pathOutput.trim().split('\n')[0];

      // 버전 확인
      const { stdout: versionOutput } = await execAsync('claude --version', { timeout: 10000 });
      const version = versionOutput.trim();

      return {
        status: 'installed',
        version,
        path: cliPath,
      };
    } catch {
      return {
        status: 'not_installed',
        error: 'Claude CLI not found in PATH',
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
          label: 'Claude Code Installation',
          url: 'https://claude.com/product/claude-code',
        },
      ],
    };
  }
}

/**
 * Claude CLI Runner 싱글톤 인스턴스
 */
export const claudeCli = new ClaudeCliRunner();

