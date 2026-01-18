/**
 * /passAgent 커맨드 구현
 * Custom Agent의 modeInstructions를 CLI에 전달하여 실행합니다.
 */

import { ParticipantCommand, CommandContext } from '../types';
import { runCliWithStreaming } from '../../feature/utils';
import { ExtendedChatRequest } from '../../types';

/**
 * passAgent 커맨드 핸들러
 * modeInstructions를 포함하여 CLI를 실행합니다.
 * @param ctx - 커맨드 컨텍스트
 * @returns 커맨드 처리 완료 여부
 */
async function handlePassAgent(ctx: CommandContext): Promise<boolean> {
  const { request, context, stream, token, config, prompt } = ctx;
  const modeInstructions = (request as ExtendedChatRequest).modeInstructions2;

  await runCliWithStreaming({
    cliRunner: config.cliRunner,
    name: config.name,
    prompt: prompt ?? '',
    references: request.references,
    history: context.history,
    stream,
    token,
    modeInstructions,
    commandName: 'passAgent',
  });

  return true;
}

/**
 * passAgent 커맨드 설정
 */
export const passAgentCommand: ParticipantCommand = {
  name: 'passAgent',
  description: 'Pass custom agent instructions to CLI',
  handler: handlePassAgent,
};
