/**
 * /session 커맨드 구현
 * 현재 세션 정보를 표시합니다.
 */

import { ParticipantCommand, CommandContext } from '../types';
import { ChatSessionManager } from '../../session';

/**
 * session 커맨드 핸들러
 * @param ctx - 커맨드 컨텍스트
 * @returns 커맨드 처리 완료 여부
 */
async function handleSession(ctx: CommandContext): Promise<boolean> {
  const { context, stream, config } = ctx;
  const { cliRunner, name } = config;

  const sessionId = ChatSessionManager.findSessionId(context.history);

  if (sessionId) {
    stream.markdown(`📍 **Current Session**\n\n`);
    stream.markdown(`- **CLI**: ${name}\n`);
    stream.markdown(`- **Session ID**: \`${sessionId}\`\n\n`);
    stream.markdown(
      `> This session can be resumed using the CLI directly with:\n> \`\`\`\n> ${cliRunner.name} --resume ${sessionId}\n> \`\`\``
    );
  } else {
    stream.markdown(`ℹ️ **No Active Session**\n\n`);
    stream.markdown(`Start a conversation with **@${cliRunner.name}** to create a new session.`);
  }

  return true;
}

/**
 * session 커맨드 설정
 */
export const sessionCommand: ParticipantCommand = {
  name: 'session',
  description: 'Show current session information',
  handler: handleSession,
};
