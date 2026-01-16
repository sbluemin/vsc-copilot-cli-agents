/**
 * Chat History 기반 세션 관리자
 * context.history에서 세션 ID를 검색하고 저장하는 유틸리티
 */

import * as vscode from 'vscode';

/**
 * 세션 ID 마커 패턴: [](cca:sessionId)
 * 빈 링크 형태로 저장하여 사용자에게 보이지 않음
 */
const SESSION_MARKER_PATTERN = /\[\]\(cca:([^)]+)\)/;

/**
 * Chat History 기반 세션 관리자
 */
export class ChatSessionManager {
  /**
   * history에서 기존 세션 ID 검색
   * @param history - Chat history
   * @returns 세션 ID 또는 undefined
   */
  static findSessionId(
    history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
  ): string | undefined {
    for (const turn of history) {
      if (turn instanceof vscode.ChatResponseTurn) {
        for (const part of turn.response) {
          if (part instanceof vscode.ChatResponseMarkdownPart) {
            const match = part.value.value.match(SESSION_MARKER_PATTERN);
            if (match) {
              return match[1];
            }
          }
        }
      }
    }
    return undefined;
  }

  /**
   * 세션 ID를 스트림에 마커로 저장
   * @param stream - Chat response stream
   * @param sessionId - 저장할 세션 ID
   */
  static saveSessionId(stream: vscode.ChatResponseStream, sessionId: string): void {
    stream.markdown(`[](cca:${sessionId})`);
  }
}
