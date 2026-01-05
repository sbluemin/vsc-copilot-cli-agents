/**
 * Scaffold Code Agents 커맨드 구현
 *
 * 워크스페이스에 Code Agents 관련 디렉토리 구조와 파일을 스캐폴딩합니다.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CommandConfig } from './types';

/**
 * .github 디렉토리 하위에 생성할 디렉토리 목록
 */
const GITHUB_SUBDIRECTORIES = ['agents', 'prompts', 'instructions'] as const;

/**
 * 스캐폴딩 결과
 */
interface ScaffoldResult {
  /** 생성된 항목 목록 */
  created: string[];
  /** 건너뛴 항목 목록 (이미 존재) */
  skipped: string[];
  /** 오류 발생 항목 목록 */
  errors: Array<{ path: string; error: string }>;
}

/**
 * 디렉토리가 존재하는지 확인
 */
function directoryExists(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 파일 또는 심볼릭 링크가 존재하는지 확인
 */
function fileOrSymlinkExists(filePath: string): boolean {
  try {
    fs.lstatSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 디렉토리 생성 (이미 존재하면 건너뜀)
 */
function ensureDirectory(dirPath: string, baseDir: string, result: ScaffoldResult): void {
  const relativePath = path.relative(baseDir, dirPath);

  if (directoryExists(dirPath)) {
    result.skipped.push(`📁 ${relativePath}`);
    return;
  }

  try {
    fs.mkdirSync(dirPath, { recursive: true });
    result.created.push(`📁 ${relativePath}`);
  } catch (error) {
    result.errors.push({
      path: relativePath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 파일 생성 (이미 존재하면 건너뜀)
 */
function ensureFile(filePath: string, content: string, baseDir: string, result: ScaffoldResult): void {
  const relativePath = path.relative(baseDir, filePath);

  if (fileOrSymlinkExists(filePath)) {
    result.skipped.push(`📄 ${relativePath}`);
    return;
  }

  try {
    // 상위 디렉토리가 없으면 생성
    const dir = path.dirname(filePath);
    if (!directoryExists(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    result.created.push(`📄 ${relativePath}`);
  } catch (error) {
    result.errors.push({
      path: relativePath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 심볼릭 링크 또는 정션 생성 (이미 존재하면 건너뜀)
 * Windows에서는 관리자 권한이 필요 없는 정션(junction)을 사용합니다.
 */
function ensureSymlink(
  targetPath: string,
  linkPath: string,
  baseDir: string,
  result: ScaffoldResult
): void {
  const relativeLinkPath = path.relative(baseDir, linkPath);

  if (fileOrSymlinkExists(linkPath)) {
    result.skipped.push(`🔗 ${relativeLinkPath}`);
    return;
  }

  try {
    // 심볼릭 링크 생성 시 상대 경로 사용
    const linkDir = path.dirname(linkPath);
    const relativeTarget = path.relative(linkDir, targetPath);

    // Windows에서는 정션(junction)을 사용하여 관리자 권한 없이도 링크 생성 가능
    if (process.platform === 'win32') {
      fs.symlinkSync(relativeTarget, linkPath, 'junction');
    } else {
      fs.symlinkSync(relativeTarget, linkPath);
    }
    result.created.push(`🔗 ${relativeLinkPath}`);
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error);

    // Windows에서 권한 오류(EPERM)가 발생한 경우 추가 안내 제공
    const errObj = error as { code?: string } | undefined;
    if (process.platform === 'win32' && errObj && errObj.code === 'EPERM') {
      message =
        message +
        ' (On Windows, creating symbolic links usually requires administrator privileges or enabling Developer Mode. ' +
        'See https://aka.ms/vscode-symlink-permissions for more information.)';
    }

    result.errors.push({
      path: relativeLinkPath,
      error: message,
    });
  }
}

/**
 * 기본 copilot-instructions.md 내용
 */
function getDefaultCopilotInstructionsContent(): string {
  return `# Copilot Instructions

This file provides instructions to GitHub Copilot and other Code Agents.

## Project Overview

Add a description of your project here.

## Coding Conventions

Describe the coding conventions followed in this project.

## References

- [GitHub Copilot Instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-instructions)
`;
}

/**
 * 스캐폴딩 결과를 사용자에게 표시
 */
function showScaffoldResult(result: ScaffoldResult): void {
  const summary: string[] = [];

  if (result.created.length > 0) {
    summary.push(`✅ Created: ${result.created.length} item(s)`);
  }

  if (result.skipped.length > 0) {
    summary.push(`⏭️ Skipped: ${result.skipped.length} item(s)`);
  }

  if (result.errors.length > 0) {
    summary.push(`❌ Errors: ${result.errors.length} item(s)`);
  }

  const summaryMessage = summary.join('\n');

  if (result.errors.length > 0) {
    vscode.window.showWarningMessage(
      `Code Agents scaffolding completed with errors\n\n${summaryMessage}`
    );
  } else if (result.created.length > 0) {
    vscode.window.showInformationMessage(
      `Code Agents scaffolding completed!\n\n${summaryMessage}`
    );
  } else {
    vscode.window.showInformationMessage(
      `Code Agents scaffolding: All files already exist.\n\n${summaryMessage}`
    );
  }
}

/**
 * Scaffold Code Agents 커맨드 핸들러
 */
async function handleScaffoldLlm(): Promise<void> {
  // 1. 워크스페이스 폴더 확인
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      'A workspace folder is required to perform Code Agents scaffolding.'
    );
    return;
  }

  // 2. 디렉토리 선택
  let selectedFolder: vscode.WorkspaceFolder;

  if (workspaceFolders.length === 1) {
    // 워크스페이스 폴더가 하나면 자동 선택
    selectedFolder = workspaceFolders[0];
  } else {
    // 여러 개면 사용자에게 선택하게 함
    const items = workspaceFolders.map((folder) => ({
      label: folder.name,
      description: folder.uri.fsPath,
      folder,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a directory to scaffold Code Agents',
      title: 'Scaffold Code Agents',
    });

    if (!selected) {
      // 사용자가 취소함
      return;
    }

    selectedFolder = selected.folder;
  }

  const selectedDir = selectedFolder.uri.fsPath;
  const result: ScaffoldResult = {
    created: [],
    skipped: [],
    errors: [],
  };

  // 2.1. .github/copilot-instructions.md 생성
  const githubDir = path.join(selectedDir, '.github');
  const copilotInstructionsPath = path.join(githubDir, 'copilot-instructions.md');

  ensureDirectory(githubDir, selectedDir, result);
  ensureFile(copilotInstructionsPath, getDefaultCopilotInstructionsContent(), selectedDir, result);

  // 2.2 ~ 2.4. .github 하위 디렉토리 및 .gitkeep 생성
  for (const subDir of GITHUB_SUBDIRECTORIES) {
    const subDirPath = path.join(githubDir, subDir);
    const gitkeepPath = path.join(subDirPath, '.gitkeep');

    ensureDirectory(subDirPath, selectedDir, result);
    ensureFile(gitkeepPath, '', selectedDir, result);
  }

  // 2.5. GEMINI.md 심볼릭 링크 생성
  const geminiLinkPath = path.join(selectedDir, 'GEMINI.md');
  ensureSymlink(copilotInstructionsPath, geminiLinkPath, selectedDir, result);

  // 2.6. CLAUDE.md 심볼릭 링크 생성
  const claudeLinkPath = path.join(selectedDir, 'CLAUDE.md');
  ensureSymlink(copilotInstructionsPath, claudeLinkPath, selectedDir, result);

  // 결과 표시
  showScaffoldResult(result);

  // 탐색기 새로고침
  await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
}

/**
 * Scaffold Code Agents 커맨드 설정
 */
export const scaffoldLlmCommand: CommandConfig = {
  id: 'copilot-cli-agents.scaffold-llm',
  handler: handleScaffoldLlm,
};
