# Gemini CLI 사용법

## 개요

Gemini CLI는 Google의 Gemini 모델과 상호작용하기 위한 명령줄 도구입니다.

## Non-Interactive 모드

Chat Participant에서 사용할 때는 Non-Interactive 모드를 사용합니다.

### 기본 사용법

```bash
# Positional argument로 프롬프트 전달 (권장)
gemini "프롬프트 내용"

# -p/--prompt 플래그 사용 (deprecated, 향후 제거 예정)
gemini -p "프롬프트 내용"
```

### 주요 옵션

| 옵션 | 설명 |
|------|------|
| `-m, --model <model>` | 사용할 모델 지정 |
| `-o, --output-format <format>` | 출력 형식 지정: `text`, `json`, `stream-json` |
| `-y, --yolo` | 모든 액션 자동 승인 (YOLO 모드) |
| `--approval-mode <mode>` | 승인 모드 설정: `default`, `auto_edit`, `yolo` |
| `-d, --debug` | 디버그 모드 활성화 |

### 출력 형식

```bash
# 스트리밍 JSON 출력 (Chat Participant용 권장)
gemini "질문" -o stream-json
```

### stream-json 출력 형식 스펙

stream-json 모드에서는 각 줄마다 하나의 JSON 객체가 출력됩니다 (NDJSON 형식).

#### 메시지 타입

| type | 설명 |
|------|------|
| `init` | 세션 초기화 정보 |
| `message` | 사용자/어시스턴트 메시지 |
| `result` | 최종 결과 및 통계 |

#### 1. init (세션 초기화)

```json
{
  "type": "init",
  "timestamp": "2026-01-01T06:14:30.755Z",
  "session_id": "96a8334e-6c28-43b0-8cd5-c1b3723e74b4",
  "model": "auto-gemini-3"
}
```

#### 2. message (사용자 메시지)

```json
{
  "type": "message",
  "timestamp": "2026-01-01T06:14:30.757Z",
  "role": "user",
  "content": "Hello, what is 1+1?\n\n\n"
}
```

#### 3. message (어시스턴트 응답)

```json
{
  "type": "message",
  "timestamp": "2026-01-01T06:14:37.325Z",
  "role": "assistant",
  "content": "1+1은 2입니다.",
  "delta": true
}
```

- `delta: true` - 스트리밍 중 부분 응답임을 나타냄

#### 4. result (최종 결과)

```json
{
  "type": "result",
  "timestamp": "2026-01-01T06:14:37.334Z",
  "status": "success",
  "stats": {
    "total_tokens": 6508,
    "input_tokens": 6023,
    "output_tokens": 79,
    "cached": 3205,
    "input": 2818,
    "duration_ms": 6579,
    "tool_calls": 0
  }
}
```

### Chat Participant용 권장 명령어

```bash
# 기본 Non-Interactive 호출 (stream-json 사용)
gemini "프롬프트" -o stream-json

# 자동 승인 모드 (도구 사용 시)
gemini "프롬프트" -o stream-json -y
```

## 파이프 사용

```bash
# stdin으로 입력 전달
echo "프롬프트" | gemini

# 파일 내용 전달
cat file.txt | gemini "이 내용을 요약해줘"
```

## 세션 관리

Gemini CLI는 대화 세션을 저장하고 재개할 수 있는 기능을 제공합니다.

### 세션 관련 옵션

| 옵션 | 설명 |
|------|------|
| `-r, --resume <session>` | 이전 세션 복원 (`latest`, 인덱스 번호, 또는 세션 UUID) |
| `--list-sessions` | 현재 프로젝트의 사용 가능한 세션 목록 표시 |
| `--delete-session <index>` | 인덱스 번호로 세션 삭제 |

### 세션 목록 확인

```bash
# 현재 프로젝트의 세션 목록 보기
gemini --list-sessions

# 출력 예시:
# Available sessions for this project (1):
#   1. What is 2+2 (Just now) [ec0182e8-e3b1-402b-b658-81220200c942]
```

### 세션 재개 (Resume)

```bash
# 가장 최근 세션 재개
gemini "후속 질문" -r latest -o json

# 인덱스 번호로 재개 (--list-sessions에서 확인)
gemini "후속 질문" -r 1 -o json

# 세션 UUID로 재개
gemini "후속 질문" -r "ec0182e8-e3b1-402b-b658-81220200c942" -o json
```

### Chat Participant에서의 세션 활용 예시

```bash
# 1. 첫 호출 - 응답에서 session_id 저장
gemini "프로젝트 분석해줘" -o json
# 응답: {"session_id": "ec0182e8-...", ...}

# 2. 후속 호출 - 저장된 session_id로 대화 이어가기
gemini "이전 분석 결과를 바탕으로 리팩토링 제안해줘" -r "ec0182e8-..." -o json
```

### 세션 삭제

```bash
# 인덱스 번호로 세션 삭제
gemini --delete-session 1
```

## 추가 옵션

| 옵션 | 설명 |
|------|------|
| `-i, --prompt-interactive` | 프롬프트 실행 후 대화형 모드 진입 |
| `-s, --sandbox` | 샌드박스 모드 실행 |
| `--allowed-tools <tools>` | 확인 없이 실행 허용할 도구 목록 |
| `-e, --extensions <list>` | 사용할 확장 목록 |
| `--include-directories <dirs>` | 워크스페이스에 포함할 추가 디렉토리 |
| `-v, --version` | 버전 정보 출력 |
| `-h, --help` | 도움말 출력 |

## MCP 서버 관리

```bash
# MCP 서버 관리 명령
gemini mcp

# 특정 MCP 서버만 허용
gemini --allowed-mcp-server-names server1,server2 "프롬프트"
```

## 확장 관리

```bash
# 사용 가능한 확장 목록 보기
gemini -l

# 특정 확장만 사용
gemini -e extension1 -e extension2 "프롬프트"
```
