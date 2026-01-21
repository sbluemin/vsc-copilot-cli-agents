/**
 * /handoff 커맨드 구현
 * 대화형 CLI 터미널로 현재 세션을 이전합니다.
 */

import * as vscode from 'vscode';
import { ParticipantCommand, CommandContext } from '../types';
import { ChatSessionManager } from '../../session';

/**
 * handoff 커맨드 핸들러
 * @param ctx - 커맨드 컨텍스트
 * @returns 커맨드 처리 완료 여부
 */
async function handleHandoff(ctx: CommandContext): Promise<boolean> {
  const { context, stream, config} = ctx;
  const { cliRunner, name, iconPath } = config;

  const sessionId = ChatSessionManager.findSessionId(context.history);

  if (!sessionId) {
    stream.markdown(`❌ **No Active Session**\n\n`);
    stream.markdown(`You need an active session to hand off to the CLI.\n`);
    stream.markdown(`Start a conversation with **@${cliRunner.name}** first, then use \`/handoff\`.`);
    return true;
  }

  try {
    // CLI 명령어 구성
    const cliCommand = [
      cliRunner.name, 
      ...cliRunner.getArgumentModel(),
      ...cliRunner.getArgumentResume(sessionId),
      ...cliRunner.getArgumentDirectories(),
    ].join(' ');

    // 에디터 사이드 영역에 터미널 생성 (Windows에서는 cmd 사용)
    const terminal = vscode.window.createTerminal({
      name: `${name} CLI`,
      location: {
        viewColumn: vscode.ViewColumn.Beside,
      },
      iconPath,
      ...(process.platform === 'win32' && {
        shellPath: 'cmd.exe',
      }),
    });
    terminal.show();
    terminal.sendText(cliCommand);

    stream.markdown(`🚀 **Handoff Successful**\n\n`);
    stream.markdown(
      `Interactive ${name} CLI has been opened in a side terminal with session \`${sessionId}\`.\n\n`
    );
    stream.markdown(`> You can continue your conversation directly in the terminal.`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    stream.markdown(`❌ **Error during handoff:** ${errorMessage}`);
  }

  return true;
}

/**
 * handoff 커맨드 설정
 */
export const handoffCommand: ParticipantCommand = {
  name: 'handoff',
  description: 'Hand off session to interactive CLI terminal',
  handler: handleHandoff,
};
