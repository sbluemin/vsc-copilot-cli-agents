/**
 * /doctor 커맨드 구현
 * CLI 상태를 확인하고 결과를 출력합니다.
 */

import { formatHealthReport } from '../../../cli/utils';
import { CliHealthStatus, DoctorResult, CliRunner } from '../../../cli/types';
import { ParticipantCommand, CommandContext } from '../types';

/**
 * CLI 상태 검증 실행
 * @param cliRunner - CLI Runner 인스턴스
 * @returns Doctor 검증 결과
 */
async function runDoctor(cliRunner: CliRunner): Promise<DoctorResult> {
  const install = await cliRunner.checkInstallation();

  const status: CliHealthStatus = {
    cli: cliRunner.name,
    install,
    checkedAt: new Date(),
  };

  return {
    status,
    installGuidance: cliRunner.getInstallGuidance(),
  };
}

/**
 * doctor 커맨드 핸들러
 * @param ctx - 커맨드 컨텍스트
 * @returns 커맨드 처리 완료 여부
 */
async function handleDoctor(ctx: CommandContext): Promise<boolean> {
  const { stream, config } = ctx;
  const { cliRunner, name } = config;

  try {
    stream.progress(`🔍 Checking ${name} CLI status...`);
    const result = await runDoctor(cliRunner);

    const report = formatHealthReport(result);
    stream.markdown(report);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    stream.markdown(`❌ **Error during health check:** ${errorMessage}`);
  }

  return true;
}

/**
 * doctor 커맨드 설정
 */
export const doctorCommand: ParticipantCommand = {
  name: 'doctor',
  description: 'Check CLI health status',
  handler: handleDoctor,
};
