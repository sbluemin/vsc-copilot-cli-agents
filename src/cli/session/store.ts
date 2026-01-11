/**
 * 세션 저장소 모듈
 *
 * VSCode Copilot Session ID와 CLI Session ID 간의 매핑을 관리합니다.
 * 저장 위치: .github/copilot-cli-agents.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { SessionStoreData, CopilotSessionMapping, CliSessionInfo, CliType } from './types';

/** 세션 저장 파일 경로 */
const SESSION_FILE_NAME = '.github/copilot-cli-agents.json';

/** 현재 스토어 버전 */
const STORE_VERSION = 1;

/**
 * 세션 저장소 클래스
 */
export class SessionStore {
  private readonly filePath: string;
  private data: SessionStoreData;

  /**
   * SessionStore 생성자
   * @param workspaceRoot - 워크스페이스 루트 경로
   */
  constructor(workspaceRoot: string) {
    this.filePath = path.join(workspaceRoot, SESSION_FILE_NAME);
    this.data = this.load();
  }

  /**
   * 세션 데이터 로드
   */
  private load(): SessionStoreData {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(content) as SessionStoreData;

        // 버전 확인 (향후 마이그레이션 로직 추가 가능)
        if (parsed.version === STORE_VERSION) {
          return parsed;
        }
      }
    } catch {
      // 파일 읽기 실패 시 새로 생성
    }

    return {
      version: STORE_VERSION,
      sessions: {},
    };
  }

  /**
   * 세션 데이터 저장
   */
  private save(): void {
    try {
      // .github 디렉토리 확인 및 생성
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[SessionStore] Failed to save session data:', error);
    }
  }

  /**
   * CLI 세션 ID 조회
   * @param copilotSessionId - VSCode Copilot 세션 ID
   * @param cliType - CLI 타입
   * @returns CLI 세션 ID 또는 undefined
   */
  getCliSessionId(copilotSessionId: string, cliType: CliType): string | undefined {
    this.data = this.load(); // Refresh from file
    const mapping = this.data.sessions[copilotSessionId];
    return mapping?.[cliType]?.cliSessionId;
  }

  /**
   * CLI 세션 정보 조회
   * @param copilotSessionId - VSCode Copilot 세션 ID
   * @param cliType - CLI 타입
   * @returns CLI 세션 정보 또는 undefined
   */
  getCliSession(copilotSessionId: string, cliType: CliType): CliSessionInfo | undefined {
    this.data = this.load(); // Refresh from file
    return this.data.sessions[copilotSessionId]?.[cliType];
  }

  /**
   * CLI 세션 ID 저장/업데이트
   * @param copilotSessionId - VSCode Copilot 세션 ID
   * @param cliType - CLI 타입
   * @param cliSessionId - CLI 세션 ID
   */
  setCliSessionId(copilotSessionId: string, cliType: CliType, cliSessionId: string): void {
    this.data = this.load(); // Refresh from file before update
    const now = new Date().toISOString();

    // 기존 매핑이 없으면 생성
    if (!this.data.sessions[copilotSessionId]) {
      this.data.sessions[copilotSessionId] = {};
    }

    const existingSession = this.data.sessions[copilotSessionId][cliType];

    this.data.sessions[copilotSessionId][cliType] = {
      cliSessionId,
      createdAt: existingSession?.createdAt || now,
      lastUsedAt: now,
    };

    this.save();
  }

  /**
   * 특정 Copilot 세션의 모든 매핑 조회
   * @param copilotSessionId - VSCode Copilot 세션 ID
   * @returns 세션 매핑 또는 undefined
   */
  getCopilotSession(copilotSessionId: string): CopilotSessionMapping | undefined {
    this.data = this.load(); // Refresh from file
    return this.data.sessions[copilotSessionId];
  }

  /**
   * 특정 Copilot 세션 삭제
   * @param copilotSessionId - VSCode Copilot 세션 ID
   */
  deleteCopilotSession(copilotSessionId: string): void {
    this.data = this.load(); // Refresh from file before update
    delete this.data.sessions[copilotSessionId];
    this.save();
  }

  /**
   * 오래된 세션 정리
   * @param maxAgeMs - 최대 보관 기간 (밀리초, 기본값: 7일)
   */
  cleanup(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
    this.data = this.load(); // Refresh from file before update
    const now = Date.now();
    let changed = false;

    for (const [copilotSessionId, mapping] of Object.entries(this.data.sessions)) {
      let hasActiveSession = false;

      for (const cliType of ['gemini', 'claude'] as CliType[]) {
        const session = mapping[cliType];
        if (session) {
          const lastUsed = new Date(session.lastUsedAt).getTime();
          if (now - lastUsed > maxAgeMs) {
            delete mapping[cliType];
            changed = true;
          } else {
            hasActiveSession = true;
          }
        }
      }

      // 모든 CLI 세션이 삭제되면 Copilot 세션도 삭제
      if (!hasActiveSession) {
        delete this.data.sessions[copilotSessionId];
        changed = true;
      }
    }

    if (changed) {
      this.save();
    }
  }

  /**
   * 전체 세션 수 조회
   */
  get sessionCount(): number {
    this.data = this.load(); // Refresh from file
    return Object.keys(this.data.sessions).length;
  }
}
