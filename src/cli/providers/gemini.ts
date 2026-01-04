/**
 * Gemini CLI Provider
 */

import { SpawnCliRunner, ParseResult } from '../runners';
import { GeminiStreamMessage, StreamContent } from '../types';

export class GeminiCliRunner extends SpawnCliRunner {
  readonly name = 'gemini';

  protected buildCliOptions(resumeSessionId?: string): { command: string; args: string[] } {
    const args = ['--allowed-tools', 'google_web_search', '--output-format', 'stream-json'];

    // 세션 재개 옵션 추가
    if (resumeSessionId) {
      args.push('--resume', resumeSessionId);
    }

    return {
      command: 'gemini',
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
}

/**
 * Gemini CLI Runner 싱글톤 인스턴스
 */
export const geminiCli = new GeminiCliRunner();
