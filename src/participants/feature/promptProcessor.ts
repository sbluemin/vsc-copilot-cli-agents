/**
 * 프롬프트 처리 유틸리티
 *
 * - `#file:~` 형태의 special string을 실제 파일 경로로 치환
 * - ChatPromptReference를 활용한 파일 참조 처리
 */

import * as vscode from 'vscode';

/**
 * ChatPromptReference에서 파일 경로 추출
 * @param ref - Chat 프롬프트 레퍼런스
 * @returns 파일 경로 문자열 또는 undefined
 */
function extractFilePath(ref: vscode.ChatPromptReference): string | undefined {
  const { value } = ref;

  // Uri 타입인 경우
  if (value instanceof vscode.Uri) {
    return value.fsPath;
  }

  // Location 타입인 경우 (uri 프로퍼티 확인)
  if (value && typeof value === 'object' && 'uri' in value) {
    const location = value as vscode.Location;
    return location.uri.fsPath;
  }

  // 문자열인 경우 그대로 반환
  if (typeof value === 'string') {
    return value;
  }

  return undefined;
}

/**
 * 프롬프트에서 #file:~ 형태의 참조를 실제 파일 경로로 치환
 *
 * @param prompt - 원본 프롬프트 문자열
 * @param references - ChatPromptReference 배열
 * @returns 파일 경로로 치환된 프롬프트
 *
 * @example
 * // references에 { id: 'file:config.json', value: Uri('/path/to/config.json'), range: [10, 25] } 가 있을 때
 * // "Check #file:config.json for errors" -> "Check /path/to/config.json for errors"
 */
export function resolveFileReferences(
  prompt: string,
  references: readonly vscode.ChatPromptReference[]
): string {
  // range가 없는 참조는 프롬프트에 포함되지 않은 것이므로 제외
  // range가 있는 참조만 역순으로 정렬하여 뒤에서부터 치환 (인덱스 변경 방지)
  const rangedRefs = references
    .filter((ref): ref is typeof ref & { range: [number, number] } => ref.range !== undefined)
    .sort((a, b) => b.range[0] - a.range[0]);

  let result = prompt;

  for (const ref of rangedRefs) {
    const filePath = extractFilePath(ref);
    if (!filePath) {
      continue;
    }

    const [start, end] = ref.range;
    // 프롬프트에서 해당 범위를 파일 경로로 치환
    result = result.slice(0, start) + filePath + result.slice(end);
  }

  return result;
}
