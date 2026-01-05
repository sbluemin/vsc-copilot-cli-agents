/**
 * Claude 모델 변경 커맨드 구현
 */

import * as vscode from 'vscode';
import { CommandConfig } from './types';

/**
 * 모델 선택 UI를 표시하고 사용자가 선택한 모델을 설정에 저장
 */
async function handleChangeClaudeModel(): Promise<void> {
  const models = [
    { label: 'Sonnet', description: 'Balanced performance and cost', value: 'sonnet' },
    { label: 'Opus', description: 'Most capable', value: 'opus' },
    { label: 'Haiku', description: 'Fastest and most cost-effective', value: 'haiku' },
    { label: 'Custom...', description: 'Enter custom model name', value: 'custom' },
  ];

  const selected = await vscode.window.showQuickPick(models, {
    placeHolder: 'Select Claude model',
  });

  if (!selected) {
    return;
  }

  const config = vscode.workspace.getConfiguration('copilot-cli-agents.claude');

  if (selected.value === 'custom') {
    const customModel = await vscode.window.showInputBox({
      prompt: 'Enter custom model name (e.g., claude-sonnet-4-5-20250929)',
      placeHolder: 'claude-sonnet-4-5-20250929',
    });

    if (customModel) {
      await config.update('customModel', customModel, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Claude model set to: ${customModel}`);
      console.log(`[copilot-cli-agents] Claude model updated: ${customModel}`);
    }
  } else {
    await config.update('model', selected.value, vscode.ConfigurationTarget.Global);
    await config.update('customModel', undefined, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Claude model set to: ${selected.label}`);
    console.log(`[copilot-cli-agents] Claude model updated: ${selected.label}`);
  }
}

/**
 * Claude 모델 변경 커맨드 설정
 */
export const changeClaudeModelCommand: CommandConfig = {
  id: 'copilot-cli-agents.change-claude-model',
  handler: handleChangeClaudeModel,
};
