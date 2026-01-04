/**
 * Claude CLI Provider
 */

import { SpawnCliRunner } from '../runners';
import { ClaudeStreamMessage, StreamContent } from '../types';

export class ClaudeCliRunner extends SpawnCliRunner {
  readonly name = 'claude';

  protected buildCliOptions(): { command: string; args: string[] } {
    return {
      command: 'claude',
      args: ['--allowed-tools', 'WebSearch', '--output-format', 'stream-json', '--verbose'],
    };
  }

  protected buildPromptArgument(prompt: string): string[] {
    // claude는 -p <prompt> 형태로 전달
    return ['-p', prompt];
  }

  protected parseLine(line: string): StreamContent | null {
    try {
      const message = JSON.parse(line) as ClaudeStreamMessage;

      if (message.type === 'assistant' && message.message?.content) {
        for (const item of message.message.content) {
          // tool_use 타입 처리
          if (item.type === 'tool_use') {
            return {
              type: 'tool_use',
              content: item.name || 'tool',
              toolName: item.name,
            };
          }

          // tool_result 타입 처리
          if (item.type === 'tool_result') {
            return {
              type: 'tool_result',
              content: item.content || '',
              toolName: item.name,
            };
          }
          
          // text 타입 처리
          if (item.type === 'text' && item.text) {
            return {
              type: 'text',
              content: item.text,
            };
          }
        }
      }

      return null;
    } catch {
      // JSON 파싱 실패 시 무시
      return null;
    }
  }
}

/**
 * Claude CLI Runner 싱글톤 인스턴스
 */
export const claudeCli = new ClaudeCliRunner();
