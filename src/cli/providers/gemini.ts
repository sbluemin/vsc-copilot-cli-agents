/**
 * Gemini CLI Provider
 */

import { SpawnCliRunner } from '../runners';
import { GeminiStreamMessage, StreamContent } from '../types';

export class GeminiCliRunner extends SpawnCliRunner {
  readonly name = 'gemini';

  protected buildCliOptions(): { command: string; args: string[] } {
    return {
      command: 'gemini',
      args: ['--allowed-tools', 'google_web_search', '--output-format', 'stream-json'],
    };
  }

  protected buildPromptArgument(prompt: string): string[] {
    // gemini는 prompt를 그대로 첫 번째 인자로 전달
    return [prompt];
  }

  protected parseLine(line: string): StreamContent | null {
    try {
      const message = JSON.parse(line) as GeminiStreamMessage;

      // tool_use 타입 처리
      if (message.type === 'tool_use') {
        return {
          type: 'tool_use',
          content: message.tool_name || 'tool',
          toolName: message.tool_name,
        };
      }

      // tool_result 타입 처리
      if (message.type === 'tool_result') {
        return {
          type: 'tool_result',
          content: message.output || '',
          toolName: message.tool_name,
        };
      }

      // assistant 메시지의 content만 추출
      if (message.type === 'message' && message.role === 'assistant' && message.content) {
        return {
          type: 'text',
          content: message.content,
        };
      }

      return null;
    } catch {
      // JSON 파싱 실패 시 무시
      return null;
    }
  }
}

/**
 * Gemini CLI Runner 싱글톤 인스턴스
 */
export const geminiCli = new GeminiCliRunner();
