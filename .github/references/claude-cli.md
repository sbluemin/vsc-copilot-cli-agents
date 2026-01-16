# Claude CLI 사용법

## 개요

Claude Code는 Anthropic의 Claude 모델과 상호작용하기 위한 명령줄 도구입니다.

## Non-Interactive 모드

Chat Participant에서 사용할 때는 `-p/--print` 옵션을 사용하여 Non-Interactive 모드로 실행합니다.

### 기본 사용법

```bash
# Non-Interactive 모드 (응답 출력 후 종료)
claude -p "프롬프트 내용"

# 또는
claude --print "프롬프트 내용"
```

### 주요 옵션

| 옵션 | 설명 |
|------|------|
| `-p, --print` | Non-Interactive 모드, 응답 출력 후 종료 |
| `--model <model>` | 사용할 모델 지정 (예: `sonnet`, `opus`) |
| `--output-format <format>` | 출력 형식: `text`, `json`, `stream-json` |
| `--include-partial-messages` | 어시스턴트 응답 실시간 스트리밍 (부분 메시지 포함) |
| `--system-prompt <prompt>` | 시스템 프롬프트 설정 |
| `--append-system-prompt <prompt>` | 기본 시스템 프롬프트에 추가 |
| `--dangerously-skip-permissions` | 모든 권한 확인 우회 (샌드박스 전용) |

### 출력 형식

```bash
# 스트리밍 JSON 출력 (Chat Participant용 권장)
# 주의: --verbose 옵션 필수
claude -p "질문" --output-format stream-json --verbose
```

### stream-json 출력 형식 스펙

stream-json 모드에서는 각 줄마다 하나의 JSON 객체가 출력됩니다 (NDJSON 형식).

#### 메시지 타입

| type | 설명 |
|------|------|
| `system` | 시스템 초기화 정보 (subtype: `init`) |
| `assistant` | 어시스턴트 응답 메시지 |
| `result` | 최종 결과 및 통계 (subtype: `success` / `error`) |

#### 1. system (세션 초기화)

```json
{
  "type": "system",
  "subtype": "init",
  "cwd": "/path/to/workspace",
  "session_id": "ca811f9a-5214-449c-8aa7-7ad741b8ec4b",
  "tools": ["Bash", "Read", "Edit", "Write", ...],
  "mcp_servers": [],
  "model": "claude-sonnet-4-5-20250929",
  "permissionMode": "default",
  "claude_code_version": "2.0.76",
  "uuid": "9ad17f6b-e25b-448a-bf20-b4a99399f14c"
}
```

#### 2. assistant (어시스턴트 응답)

```json
{
  "type": "assistant",
  "message": {
    "model": "claude-sonnet-4-5-20250929",
    "id": "msg_01EsEykWUN7KWHdvb6Xi1LsF",
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "응답 내용"
      }
    ],
    "stop_reason": null,
    "usage": {
      "input_tokens": 2,
      "output_tokens": 5,
      "cache_read_input_tokens": 17394,
      "cache_creation_input_tokens": 1452
    }
  },
  "session_id": "ca811f9a-5214-449c-8aa7-7ad741b8ec4b",
  "uuid": "e3ded9d7-bfdc-43a5-b095-e9ecd094a41b"
}
```

- `message.content` - 응답 내용 배열 (text, tool_use 등)
- `message.stop_reason` - 응답 종료 이유 (`end_turn`, `max_tokens` 등)
- **참고**: `--include-partial-messages` 사용 시, `content[].text`에 누적된 전체 텍스트가 포함된 중간 메시지들이 여러 번 전송됩니다.

#### 3. result (최종 결과)

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 2319,
  "duration_api_ms": 2299,
  "num_turns": 1,
  "result": "응답 텍스트",
  "session_id": "ca811f9a-5214-449c-8aa7-7ad741b8ec4b",
  "total_cost_usd": 0.0107442,
  "usage": {
    "input_tokens": 2,
    "output_tokens": 5,
    "cache_read_input_tokens": 17394,
    "cache_creation_input_tokens": 1452,
    "service_tier": "standard"
  },
  "uuid": "1fae6661-55cb-4449-900c-2f186cc87cba"
}
```

### 구조화된 출력 (JSON Schema)

```bash
# JSON Schema를 사용한 구조화된 응답
claude -p "프롬프트" --json-schema '{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}'
```

### Chat Participant용 권장 명령어

```bash
# 기본 Non-Interactive 호출 (stream-json 및 실시간 스트리밍 사용)
claude -p "프롬프트" --output-format stream-json --verbose --include-partial-messages

# 권한 확인 우회 (신뢰할 수 있는 환경에서만)
claude -p "프롬프트" --output-format stream-json --verbose --include-partial-messages --dangerously-skip-permissions
```

## 파이프 사용

```bash
# stdin으로 입력 전달
echo "프롬프트" | claude -p

# 파일 내용 전달
cat file.txt | claude -p "이 내용을 요약해줘"
```

## 도구 제어

```bash
# 특정 도구만 허용
claude -p "프롬프트" --allowed-tools "Bash(git:*)" "Edit"

# 특정 도구 금지
claude -p "프롬프트" --disallowed-tools "Bash" "Edit"

# 사용 가능한 도구 지정
claude -p "프롬프트" --tools "Bash,Edit,Read"

# 모든 도구 비활성화
claude -p "프롬프트" --tools ""
```

## 권한 모드

| 모드 | 설명 |
|------|------|
| `default` | 기본 권한 모드 |
| `acceptEdits` | 편집 자동 승인 |
| `bypassPermissions` | 모든 권한 우회 |
| `dontAsk` | 권한 요청 안 함 |
| `plan` | 계획 모드 |

```bash
# 권한 모드 설정
claude -p "프롬프트" --permission-mode acceptEdits
```

## 세션 관리

Claude CLI는 대화 세션을 저장하고 재개할 수 있는 기능을 제공합니다.

### 세션 관련 옵션

| 옵션 | 설명 |
|------|------|
| `-c, --continue` | 가장 최근 대화 계속 |
| `-r, --resume <session-id>` | 세션 UUID로 대화 재개 |
| `--session-id <uuid>` | 새 대화에 특정 UUID 지정 (유효한 UUID 형식 필수) |
| `--fork-session` | 세션 재개 시 원본 유지하고 새 세션 ID로 분기 (`--resume` 또는 `--continue`와 함께 사용) |
| `--no-session-persistence` | 세션 저장 비활성화 (`--print`와 함께 사용) |

### 세션 재개 (Resume)

```bash
# 가장 최근 대화 이어가기
claude -p "후속 질문" --continue --output-format json

# 특정 세션 UUID로 재개
claude -p "후속 질문" --resume "59c75877-fa8e-4326-9979-d320504d44ff" --output-format json
```

### 세션 ID 명시적 지정

```bash
# 새 세션에 특정 UUID 지정
claude -p "질문" --session-id "11111111-2222-3333-4444-555555555555" --output-format json

# 이후 해당 세션 재개
claude -p "후속 질문" --resume "11111111-2222-3333-4444-555555555555" --output-format json
```

### 세션 분기 (Fork)

```bash
# 기존 세션의 대화 내용을 유지하면서 새 세션 ID로 분기
claude -p "다른 방향의 질문" --resume "59c75877-fa8e-4326-9979-d320504d44ff" --fork-session --output-format json

# 최근 대화에서 분기
claude -p "다른 접근 시도" --continue --fork-session --output-format json
```

### Chat Participant에서의 세션 활용 예시

```bash
# 1. 첫 호출 - 응답에서 session_id 저장
claude -p "프로젝트 분석해줘" --output-format json
# 응답: {"session_id": "abc-123-...", ...}

# 2. 후속 호출 - 저장된 session_id로 대화 이어가기
claude -p "이전 분석 결과를 바탕으로 리팩토링 제안해줘" --resume "abc-123-..." --output-format json
```

## 추가 옵션

| 옵션 | 설명 |
|------|------|
| `--max-budget-usd <amount>` | API 호출 최대 비용 제한 |
| `--mcp-config <config>` | MCP 서버 설정 JSON 로드 |
| `--add-dir <dirs>` | 도구 접근 허용할 추가 디렉토리 |
| `-v, --version` | 버전 정보 출력 |
| `-h, --help` | 도움말 출력 |

## MCP 서버 관리

```bash
# MCP 설정 명령
claude mcp

# MCP 서버 설정 파일 로드
claude -p "프롬프트" --mcp-config mcp-config.json

# MCP 설정만 사용 (다른 MCP 설정 무시)
claude -p "프롬프트" --strict-mcp-config --mcp-config mcp-config.json
```

## 모델 지정

```bash
# 모델 별칭 사용
claude -p "프롬프트" --model sonnet
claude -p "프롬프트" --model opus

# 전체 모델명 사용
claude -p "프롬프트" --model claude-sonnet-4-5-20250929

# 폴백 모델 설정 (과부하 시)
claude -p "프롬프트" --model opus --fallback-model sonnet
```

## 스트리밍 입출력

```bash
# 스트리밍 JSON 입출력 (실시간 상호작용)
claude -p --input-format stream-json --output-format stream-json --verbose

# 부분 메시지 포함 (실시간 텍스트 스트리밍)
claude -p "프롬프트" --output-format stream-json --verbose --include-partial-messages
```
