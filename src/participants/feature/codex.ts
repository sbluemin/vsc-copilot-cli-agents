/**
 * Codex CLI Participant
 */

import * as vscode from 'vscode';
import { SpawnCliRunner, ParseResult } from '../../cli/spawnCliRunner';
import { CodexStreamMessage, StreamContent, InstallInfo, HealthGuidance } from '../../cli/types';
import { executeCommand } from '../../cli/spawnCliRunner';
import { ModeInstructions, ParticipantConfig } from '../types';

export class CodexCliRunner extends SpawnCliRunner {
  readonly name = 'codex';

  getArgumentOutputFormat(): string[] {
    // JSONL 형식으로 이벤트 출력
    return ['--json'];
  }

  getArgumentAllowedTools(): string[] {
    const config = vscode.workspace.getConfiguration('CCA');
    const useWebSearch = config.get<boolean>('codex.useWebSearch', false);
    
    // --enable 옵션으로 web_search_request feature 활성화
    return useWebSearch ? ['--enable', 'web_search_request'] : [];
  }

  getArgumentModel(): string[] {
    const config = vscode.workspace.getConfiguration('CCA');
    const args: string[] = [];

    // 모델 설정
    const model = config.get<string>('codex.model');
    if (model) {
      args.push('-m', model);
    }

    // Reasoning Effort 설정 (-c 옵션으로 config 재정의)
    const reasoningEffort = config.get<string>('codex.reasoningEffort');
    if (reasoningEffort) {
      args.push('-c', `model_reasoning_effort="${reasoningEffort}"`);
    }

    return args;
  }

  getArgumentResume(sessionId?: string): string[] {
    // Codex는 resume 서브커맨드를 사용
    // buildCliOptions에서 특수 처리됨
    return sessionId ? ['resume', sessionId] : [];
  }

  getArgumentDirectories(): string[] {
    const args: string[] = [];

    // 첫 번째 워크스페이스를 -C 옵션으로 지정
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      args.push('-C', workspaceFolders[0].uri.fsPath);

      // 추가 워크스페이스들은 --add-dir로 지정
      for (let i = 1; i < workspaceFolders.length; i++) {
        args.push('--add-dir', workspaceFolders[i].uri.fsPath);
      }
    }

    return args;
  }

  getArgumentPrompt(options: { modeInstructions?: ModeInstructions; prompt?: string }): string[] {
    const { modeInstructions, prompt } = options;

    // Codex CLI는 --system-prompt 옵션이 없으므로
    // 모드 지침을 사용자 프롬프트 앞에 추가하여 전달
    let finalPrompt = prompt ?? '';

    if (modeInstructions) {
      // 프롬팅 기법: 명확한 구분자로 모드 지침과 사용자 요청 구분
      finalPrompt = [
        '<ModeInstructions>',
        modeInstructions.name,
        modeInstructions.content,
        '</ModeInstructions>',
        '',
        '<user_request>',
        prompt ?? '',
        '</user_request>',
      ].join('\n');
    }

    // codex exec는 프롬프트를 positional argument로 전달
    return [finalPrompt];
  }

  async checkInstallation(): Promise<InstallInfo> {
    try {
      // which/where 명령으로 경로 확인 (spawn으로 안전하게 실행)
      const whichCmd = process.platform === 'win32' ? 'where' : 'which';
      const pathOutput = await executeCommand(whichCmd, ['codex'], 10000);
      const cliPath = pathOutput
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0)[0];

      // 버전 확인 (spawn으로 안전하게 실행)
      const versionOutput = await executeCommand('codex', ['--version'], 10000);
      const version = versionOutput.trim();

      return {
        status: 'installed',
        version,
        path: cliPath,
      };
    } catch (error: unknown) {
      let errorMessage = 'Codex CLI not found in PATH';

      if (error && typeof error === 'object') {
        const err = error as { code?: string; signal?: string; message?: string; killed?: boolean };

        // 다양한 오류 유형 감지
        if (err.code === 'ETIMEDOUT' || (err.killed && err.signal === 'SIGTERM')) {
          errorMessage = 'Timed out while checking Codex CLI installation';
        } else if (err.code === 'ENOENT') {
          errorMessage = 'Codex CLI executable not found. Ensure it is installed and on your PATH.';
        } else if (err.code === 'EACCES') {
          errorMessage = 'Permission denied while executing Codex CLI. Check executable permissions.';
        } else if (err.message && err.message.trim() !== '') {
          errorMessage = `Failed to verify Codex CLI installation: ${err.message}`;
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
        'After installation, run `@codex /doctor` again to verify',
      ],
      links: [
        {
          label: 'Codex CLI GitHub Repository',
          url: 'https://github.com/openai/codex',
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

    // Codex는 'exec' 서브커맨드 사용
    args.push('exec');

    // Session resume 처리
    // codex exec resume는 resume 뒤에 session-id와 prompt만 받으므로
    // 옵션들을 먼저 배치하고 resume [session-id] [prompt]를 마지막에 추가
    if (resumeSessionId) {
      // 디렉토리 옵션 (resume 전에)
      args.push(...this.getArgumentDirectories());

      // 출력 형식 (resume 전에)
      args.push(...this.getArgumentOutputFormat());

      // 웹 검색 옵션 (resume 전에)
      args.push(...this.getArgumentAllowedTools());

      // 모델 옵션 (resume 전에)
      args.push(...this.getArgumentModel());

      // resume 서브커맨드와 session-id
      args.push(...this.getArgumentResume(resumeSessionId));

      // 프롬프트 (마지막에 추가)
      args.push(...this.getArgumentPrompt({ modeInstructions: options?.modeInstructions, prompt: options?.prompt }));
    } else {
      // 일반 exec 모드
      // 디렉토리 옵션
      args.push(...this.getArgumentDirectories());

      // 출력 형식
      args.push(...this.getArgumentOutputFormat());

      // 웹 검색 옵션
      args.push(...this.getArgumentAllowedTools());

      // 모델 옵션
      args.push(...this.getArgumentModel());

      // 프롬프트 (마지막에 추가)
      args.push(...this.getArgumentPrompt({ modeInstructions: options?.modeInstructions, prompt: options?.prompt }));
    }

    return {
      command: 'codex',
      args,
    };
  }

  protected parseLineWithSession(line: string): ParseResult {
    try {
      const message = JSON.parse(line) as CodexStreamMessage;
      let content: StreamContent | null = null;
      let sessionId: string | undefined;

      // thread.started에서 세션 ID 추출
      if (message.type === 'thread.started' && message.thread_id) {
        sessionId = message.thread_id;
      }

      // item.completed 이벤트 처리
      if (message.type === 'item.completed' && message.item) {
        const item = message.item;

        // agent_message: 텍스트 응답
        if (item.type === 'agent_message' && item.text) {
          content = {
            type: 'text',
            content: item.text,
          };
        }

        // command_execution: 도구 사용 (셸 명령어 실행)
        else if (item.type === 'command_execution') {
          // 명령어 실행 완료 시 tool_result로 처리
          if (item.status === 'completed' || item.status === 'failed') {
            content = {
              type: 'tool_result',
              content: item.aggregated_output || '',
              toolName: 'shell',
            };
          }
        }

        // mcp_tool_call: MCP 도구 호출
        else if (item.type === 'mcp_tool_call') {
          if (item.status === 'in_progress') {
            content = {
              type: 'tool_use',
              content: item.tool || 'mcp_tool',
              toolName: item.tool,
            };
          } else if (item.status === 'completed') {
            content = {
              type: 'tool_result',
              content: '',
              toolName: item.tool,
            };
          }
        }

        // reasoning: 추론 과정
        else if (item.type === 'reasoning' && item.text) {
          content = {
            type: 'reasoning',
            content: item.text,
          };
        }
      }

      // item.started 이벤트 처리 (tool_use 시작)
      if (message.type === 'item.started' && message.item) {
        const item = message.item;

        // command_execution 시작
        if (item.type === 'command_execution' && item.command) {
          content = {
            type: 'tool_use',
            content: item.command,
            toolName: 'shell',
          };
        }
      }

      return {
        content,
        sessionId,
      };
    } catch {
      // JSON 파싱 실패 시 무시
      return { content: null };
    }
  }
}

/**
 * Codex CLI Runner 싱글톤 인스턴스
 */
const codexCli = new CodexCliRunner();

/**
 * Codex Participant 설정 생성
 * @returns Participant 설정
 */
export function createCodexParticipant(): ParticipantConfig {
  return {
    id: 'copilot-cli-agents.codex',
    name: 'Codex',
    description: 'OpenAI Codex AI Assistant',
    cliRunner: codexCli,
  };
}
