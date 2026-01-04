/**
 * Claude CLI Provider
 */

import { SpawnCliRunner, ParseResult } from '../runners';
import { ClaudeStreamMessage, StreamContent } from '../types';

export class ClaudeCliRunner extends SpawnCliRunner {
  readonly name = 'claude';

  protected buildCliOptions(resumeSessionId?: string): { command: string; args: string[] } {
    const args = ['--allowed-tools', 'WebSearch', '--output-format', 'stream-json', '--verbose'];

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
}

/**
 * Claude CLI Runner 싱글톤 인스턴스
 */
export const claudeCli = new ClaudeCliRunner();
