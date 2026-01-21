/**
 * Chat History 기반 세션 관리자
 * context.history에서 세션 ID와 Agent 이름을 검색하고 저장하는 유틸리티
 */

import * as vscode from 'vscode';

/**
 * 세션 ID 마커 패턴: [](cca:sessionId)
 * 빈 링크 형태로 저장하여 사용자에게 보이지 않음
 */
const SESSION_MARKER_PATTERN = /\[\]\(cca:([^)]+)\)/;

/**
 * Agent 이름 마커 패턴: [](cca-agent:agentName)
 * Custom Agent 지침 중복 전달 방지를 위해 사용
 */
const AGENT_MARKER_PATTERN = /\[\]\(cca-agent:([^)]+)\)/;

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
    stream.markdown(`\n[](cca:${sessionId})`);
  }

  /**
   * history에서 기존 Agent 이름 검색
   * @param history - Chat history
   * @returns Agent 이름 또는 undefined
   */
  static findAgentName(
    history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
  ): string | undefined {
    // 가장 최근 Agent 이름을 찾기 위해 역순으로 검색
    for (let i = history.length - 1; i >= 0; i--) {
      const turn = history[i];
      if (turn instanceof vscode.ChatResponseTurn) {
        for (const part of turn.response) {
          if (part instanceof vscode.ChatResponseMarkdownPart) {
            const match = part.value.value.match(AGENT_MARKER_PATTERN);
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
   * Agent 이름을 스트림에 마커로 저장
   * @param stream - Chat response stream
   * @param agentName - 저장할 Agent 이름
   */
  static saveAgentName(stream: vscode.ChatResponseStream, agentName: string): void {
    stream.markdown(`\n[](cca-agent:${agentName})`);
  }

  /**
   * Agent 지침 전달 여부 결정
   * 히스토리의 Agent와 현재 Agent가 다르면 지침 전달 필요
   * @param history - Chat history
   * @param currentAgentName - 현재 요청의 Agent 이름 (없으면 undefined)
   * @returns 지침 전달이 필요하면 true
   */
  static shouldPassAgentInstructions(
    history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>,
    currentAgentName: string | undefined
  ): boolean {
    // 현재 Agent가 없으면 전달할 필요 없음
    if (!currentAgentName) {
      return false;
    }

    // 히스토리에서 기존 Agent 검색
    const existingAgentName = this.findAgentName(history);

    // 기존 Agent가 없거나 다르면 전달 필요
    return existingAgentName !== currentAgentName;
  }
}
