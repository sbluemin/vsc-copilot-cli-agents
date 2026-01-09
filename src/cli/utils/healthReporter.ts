/**
 * Health Reporter 유틸리티
 * 
 * Doctor 결과를 마크다운 리포트로 변환합니다.
 */

import { DoctorResult, HealthGuidance } from '../types';

/**
 * 가이드 섹션을 마크다운으로 포맷팅
 */
function formatGuidance(guidance: HealthGuidance): string {
  const steps = guidance.steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
  const links = guidance.links?.map(link => `   👉 [${link.label}](${link.url})`).join('\n') ?? '';
  
  return `### ${guidance.title}
${steps}
${links ? `\n${links}` : ''}`;
}

/**
 * Doctor 결과를 마크다운 리포트로 변환
 * @param result - Doctor 검증 결과
 * @returns 마크다운 형식의 리포트 문자열
 */
export function formatHealthReport(result: DoctorResult): string {
  const { status, installGuidance } = result;
  const cliName = status.cli.charAt(0).toUpperCase() + status.cli.slice(1);
  const { install } = status;
  const timestamp = status.checkedAt.toLocaleString();

  // 설치됨
  if (install.status === 'installed') {
    return `## 🔍 CLI Health Check: ${cliName}

### Installation
- **Status**: ✅ Installed${install.version ? `\n- **Version**: ${install.version}` : ''}${install.path ? `\n- **Path**: \`${install.path}\`` : ''}
- **Checked At**: ${timestamp}

---
✅ All checks passed. ${cliName} CLI is ready to use.`;
  }

  // 미설치
  return `## 🔍 CLI Health Check: ${cliName}

### Installation
- **Status**: ❌ Not Installed
- **Checked At**: ${timestamp}

${formatGuidance(installGuidance)}

---
⚠️ Some issues found. Please follow the instructions above to resolve them.`;
}
