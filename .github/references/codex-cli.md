# Codex CLI 사용법

## 개요

Codex CLI는 OpenAI의 모델과 상호작용하기 위한 명령줄 도구입니다.

## Non-Interactive 모드

Chat Participant에서 사용할 때는 Non-Interactive 모드(`exec`)를 사용합니다.

### 기본 사용법

```bash
# Positional argument로 프롬프트 전달 (권장)
codex exec "프롬프트 내용"

# stdin으로 프롬프트 전달
echo "프롬프트 내용" | codex exec -
```

### 주요 옵션

| 옵션 | 설명 |
|------|------|
| `-m, --model <model>` | 사용할 모델 지정 |
| `--json` | JSONL 형식으로 stdout에 이벤트 출력 |
| `-o, --output-last-message <file>` | 에이전트의 마지막 메시지를 파일에 저장 |
| `--output-schema <file>` | 모델 응답 형태를 정의하는 JSON Schema 파일 경로 |
| `-s, --sandbox <mode>` | 샌드박스 정책 선택 |
| `--full-auto` | 저마찰 샌드박스 자동 실행 모드 |
| `-C, --cd <dir>` | 작업 루트 디렉토리 지정 |
| `-i, --image <file>` | 초기 프롬프트에 이미지 첨부 |

### 출력 형식

```bash
# JSONL 출력 (Chat Participant용 권장)
codex exec "질문" --json
```

### json 출력 형식 스펙

`--json` 모드에서는 각 줄마다 하나의 JSON 객체가 출력됩니다 (NDJSON/JSONL 형식).

#### 이벤트 타입

| type | 설명 |
|------|------|
| `session.start` | 세션 시작 정보 |
| `message.start` | 메시지 시작 |
| `message.delta` | 메시지 스트리밍 청크 |
| `message.complete` | 메시지 완료 |
| `exec.approval_request` | 명령 실행 승인 요청 |
| `exec.shell.start` | 셸 명령 실행 시작 |
| `exec.shell.output` | 셸 명령 출력 |
| `exec.shell.complete` | 셸 명령 실행 완료 |
| `background_event` | 백그라운드 이벤트 |
| `agent.reasoning.start` | 에이전트 추론 시작 |
| `agent.reasoning.delta` | 에이전트 추론 스트리밍 |
| `agent.reasoning.complete` | 에이전트 추론 완료 |
| `mcp.tool.start` | MCP 도구 호출 시작 |
| `mcp.tool.complete` | MCP 도구 호출 완료 |
| `session.complete` | 세션 완료 |

#### 1. session.start (세션 시작)

```json
{
  "type": "session.start",
  "session_id": "96a8334e-6c28-43b0-8cd5-c1b3723e74b4"
}
```

#### 2. message.start (메시지 시작)

```json
{
  "type": "message.start",
  "message": {
    "role": "assistant"
  }
}
```

#### 3. message.delta (스트리밍 청크)

```json
{
  "type": "message.delta",
  "delta": "응답 텍스트 조각"
}
```

#### 4. message.complete (메시지 완료)

```json
{
  "type": "message.complete",
  "message": {
    "role": "assistant",
    "content": "전체 응답 텍스트"
  }
}
```

#### 5. exec.shell.start (셸 명령 실행 시작)

```json
{
  "type": "exec.shell.start",
  "call_id": "call_abc123",
  "command": ["ls", "-la"]
}
```

#### 6. exec.shell.output (셸 명령 출력)

```json
{
  "type": "exec.shell.output",
  "call_id": "call_abc123",
  "stdout": "명령 출력 내용"
}
```

#### 7. exec.shell.complete (셸 명령 완료)

```json
{
  "type": "exec.shell.complete",
  "call_id": "call_abc123",
  "metadata": {
    "exit_code": 0
  }
}
```

#### 8. session.complete (세션 완료)

```json
{
  "type": "session.complete",
  "reason": "stop"
}
```

### Chat Participant용 권장 명령어

```bash
# 기본 Non-Interactive 호출 (JSONL 사용)
codex exec "프롬프트" --json

# 자동 실행 모드 (도구 사용 시)
codex exec "프롬프트" --json --full-auto

# 특정 디렉토리에서 실행
codex exec "프롬프트" --json -C /path/to/workspace
```

## 파이프 사용

```bash
# stdin으로 입력 전달
echo "프롬프트" | codex exec -

# 파일 내용 전달
cat file.txt | codex exec "이 내용을 요약해줘"
```

## 세션 관리

Codex CLI는 대화 세션을 저장하고 재개할 수 있는 기능을 제공합니다.

### 세션 관련 명령어

| 명령어 | 설명 |
|--------|------|
| `codex resume` | 이전 세션 재개 (선택기 표시) |
| `codex resume --last` | 가장 최근 세션 재개 |
| `codex resume <session_id>` | 특정 세션 ID로 재개 |
| `codex fork` | 이전 세션 분기 (선택기 표시) |
| `codex fork --last` | 가장 최근 세션 분기 |

### 세션 재개 (Resume)

```bash
# 가장 최근 세션 재개
codex resume --last "후속 질문"

# 특정 세션 ID로 재개
codex resume "96a8334e-6c28-43b0-8cd5-c1b3723e74b4" "후속 질문"

# 모든 세션 표시 (CWD 필터링 비활성화)
codex resume --all
```

### 세션 분기 (Fork)

```bash
# 가장 최근 세션 분기
codex fork --last "새로운 방향의 질문"

# 특정 세션 ID로 분기
codex fork "96a8334e-6c28-43b0-8cd5-c1b3723e74b4" "새로운 방향의 질문"
```

### Non-Interactive 모드에서 세션 재개

```bash
# exec 서브커맨드로 세션 재개
codex exec resume --last "후속 질문" --json
codex exec resume "session-uuid" "후속 질문" --json
```

## 코드 리뷰

Codex CLI는 비대화형 코드 리뷰 기능을 제공합니다.

### 기본 사용법

```bash
# 기본 코드 리뷰 (staged, unstaged, untracked 변경사항)
codex review --uncommitted

# 특정 브랜치와 비교하여 리뷰
codex review --base main

# 특정 커밋의 변경사항 리뷰
codex review --commit abc1234

# 커스텀 리뷰 지침 추가
codex review --uncommitted "보안 취약점에 집중해서 리뷰해줘"
```

### 리뷰 옵션

| 옵션 | 설명 |
|------|------|
| `--uncommitted` | staged, unstaged, untracked 변경사항 리뷰 |
| `--base <branch>` | 특정 브랜치와 비교하여 리뷰 |
| `--commit <sha>` | 특정 커밋의 변경사항 리뷰 |
| `--title <title>` | 리뷰 요약에 표시할 커밋 제목 |

## 샌드박스 정책

Codex CLI는 모델이 생성한 명령어 실행 시 샌드박스 정책을 적용합니다.

### 샌드박스 모드

| 모드 | 설명 |
|------|------|
| `read-only` | 읽기 전용 접근 |
| `workspace-write` | 워크스페이스 내 쓰기 허용 |
| `danger-full-access` | 전체 접근 허용 (위험) |

### 사용 예시

```bash
# 읽기 전용 모드
codex exec "파일 내용 확인해줘" -s read-only

# 워크스페이스 쓰기 모드
codex exec "코드 수정해줘" -s workspace-write

# 전체 자동 실행 모드 (workspace-write + 자동 승인)
codex exec "작업 수행해줘" --full-auto
```

### 플랫폼별 샌드박스

```bash
# macOS (Seatbelt)
codex sandbox macos <command>

# Linux (Landlock+seccomp)
codex sandbox linux <command>

# Windows (Restricted Token)
codex sandbox windows <command>
```

## 승인 정책

모델이 명령을 실행하기 전 사용자 승인이 필요한 시점을 설정합니다.

| 정책 | 설명 |
|------|------|
| `untrusted` | "신뢰된" 명령어(ls, cat, sed 등)만 자동 실행, 나머지는 승인 요청 |
| `on-failure` | 모든 명령어 자동 실행, 실패 시에만 승인 요청 |
| `on-request` | 모델이 승인 요청 시점 결정 |
| `never` | 승인 요청 없이 항상 자동 실행 |

### 사용 예시

```bash
# 신뢰된 명령어만 자동 실행
codex exec "작업 수행" -a untrusted

# 모델이 승인 요청 시점 결정
codex exec "작업 수행" -a on-request
```

## MCP 서버 관리

Codex CLI는 MCP(Model Context Protocol) 서버 관리 기능을 제공합니다 (실험적).

### MCP 명령어

```bash
# MCP 서버 목록 보기
codex mcp list

# MCP 서버 정보 확인
codex mcp get <server-name>

# MCP 서버 추가
codex mcp add <server-config>

# MCP 서버 제거
codex mcp remove <server-name>

# MCP 서버 로그인/로그아웃
codex mcp login
codex mcp logout
```

### Codex를 MCP 서버로 실행

```bash
# MCP 서버로 실행 (stdio 전송)
codex mcp-server
```

## 로그인 관리

```bash
# 로그인 (브라우저 기반)
codex login

# API 키로 로그인
printenv OPENAI_API_KEY | codex login --with-api-key

# 디바이스 인증
codex login --device-auth

# 로그인 상태 확인
codex login status

# 로그아웃
codex logout
```

## 추가 옵션

| 옵션 | 설명 |
|------|------|
| `-c, --config <key=value>` | 설정 값 재정의 (예: `-c model="o3"`) |
| `-p, --profile <profile>` | config.toml의 프로필 사용 |
| `--enable <feature>` | 특정 기능 활성화 |
| `--disable <feature>` | 특정 기능 비활성화 |
| `--oss` | 로컬 오픈소스 모델 제공자 사용 |
| `--local-provider <provider>` | 로컬 제공자 지정 (lmstudio, ollama, ollama-chat) |
| `--search` | 라이브 웹 검색 활성화 |
| `--add-dir <dir>` | 추가 쓰기 가능 디렉토리 지정 |
| `--skip-git-repo-check` | Git 저장소 외부에서 실행 허용 |
| `--no-alt-screen` | 대체 화면 모드 비활성화 (스크롤백 보존) |
| `-v, --version` | 버전 정보 출력 |
| `-h, --help` | 도움말 출력 |

## Codex Cloud

```bash
# Codex Cloud 작업 탐색 및 로컬 적용 (실험적)
codex cloud

# 특정 태스크의 diff 적용
codex apply <task_id>
```
