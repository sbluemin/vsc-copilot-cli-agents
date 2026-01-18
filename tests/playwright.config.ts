import { defineConfig } from '@playwright/test';

/**
 * Playwright 설정 파일
 *
 * VS Code Extension E2E 테스트를 위한 설정
 * - 실제 VS Code 인스턴스를 Electron으로 실행
 * - 실제 Claude CLI 호출 (Mock 없음)
 */
export default defineConfig({
  // 테스트 파일 위치
  testDir: './e2e',

  // 전체 테스트 타임아웃: 120초 (VS Code 구동 + LLM 응답 시간)
  timeout: 120_000,

  // expect 타임아웃: 60초 (LLM 응답 대기)
  expect: {
    timeout: 60_000,
  },

  // 단일 워커로 순차 실행 (VS Code 인스턴스 충돌 방지)
  workers: 1,

  // 재시도 없음 (E2E 테스트 특성상)
  retries: 0,

  // 리포터 설정
  reporter: [['list'], ['html', { open: 'never' }]],

  // 전역 설정
  use: {
    // 스크린샷 캡처
    screenshot: 'only-on-failure',

    // 비디오 녹화
    video: 'retain-on-failure',

    // 트레이스 수집
    trace: 'retain-on-failure',
  },

  // 출력 디렉토리
  outputDir: './tests/e2e/test-results',
});
