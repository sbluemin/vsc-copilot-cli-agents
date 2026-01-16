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
    .filter((ref): ref is vscode.ChatPromptReference & { range: [number, number] } => 
      ref.range !== undefined
    )
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

/**
 * 시스템 프롬프트 내의 #file:~ 패턴을 파일 경로로 치환
 *
 * 주의: 이 함수는 modeInstructions 등 references가 없는 문자열에 사용됨
 * references 배열에서 id가 'file:~'로 시작하는 참조의 value(경로)를 매핑하여 치환
 *
 * @param text - 시스템 프롬프트 또는 modeInstructions 문자열
 * @param references - ChatPromptReference 배열 (파일 경로 매핑용)
 * @returns 파일 경로로 치환된 문자열
 */
export function resolveFileReferencesInText(
  text: string,
  references: readonly vscode.ChatPromptReference[]
): string {
  // #file:으로 시작하는 패턴 찾기 (공백, 줄바꿈, 문장부호까지)
  // 예: #file:config.json, #file:src/utils.ts 등
  const fileRefPattern = /#file:([^\s,;:)\]}>'"]+)/g;

  return text.replace(fileRefPattern, (match, filename) => {
    // references에서 해당 파일명과 일치하는 참조 찾기
    const matchingRef = references.find((ref) => {
      // id가 'file:filename' 형태인 경우
      if (ref.id === `file:${filename}`) {
        return true;
      }
      // id가 'vscode.file' 등이고 value의 경로가 filename으로 끝나는 경우
      const filePath = extractFilePath(ref);
      if (filePath && filePath.endsWith(filename)) {
        return true;
      }
      return false;
    });

    if (matchingRef) {
      const filePath = extractFilePath(matchingRef);
      if (filePath) {
        return filePath;
      }
    }

    // 매칭되는 참조가 없으면 원본 유지
    return match;
  });
}
