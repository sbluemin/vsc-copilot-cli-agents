/**
 * Participant Command 모듈 진입점
 * 모든 커맨드를 등록하고 관리합니다.
 */

export * from './types';

// 커맨드 목록 export
export { doctorCommand } from './feature/doctor';
export { sessionCommand } from './feature/session';
export { handoffCommand } from './feature/handoff';
export { passAgentCommand } from './feature/passAgent';

import { ParticipantCommand } from './types';
import { doctorCommand } from './feature/doctor';
import { sessionCommand } from './feature/session';
import { handoffCommand } from './feature/handoff';
import { passAgentCommand } from './feature/passAgent';

/**
 * 등록된 모든 Participant 커맨드 목록
 */
export const participantCommands: ParticipantCommand[] = [
  doctorCommand,
  sessionCommand,
  handoffCommand,
  passAgentCommand,
];

/**
 * 커맨드 이름으로 핸들러 찾기
 * @param commandName - 커맨드 이름
 * @returns 해당 커맨드 또는 undefined
 */
export function findCommand(commandName: string): ParticipantCommand | undefined {
  return participantCommands.find((cmd) => cmd.name === commandName);
}
