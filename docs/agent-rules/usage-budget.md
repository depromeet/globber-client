# 사용량 운영 기억과 훅 계약

에이전트 위임·문서 탐색·검증 전에 적용한다. Claude·Codex의 영구 프로젝트 기억이며, 개인 홈 메모리나 서버 사용량 정산 자료를 뜻하지 않는다.

## 행동 규칙

1. Codex는 `fork_turns: "none"`을 명시하고 필요한 결정·경로·담당 범위만 전달한다. 위임문은 6,000자 이내로 쓴다. 작은 작업을 이유 없이 여러 에이전트로 나누지 않는다.
2. Codex 메인은 위임 중 담당 경로를 다시 읽거나 검증하지 않는다. 반환 후 검토에 집중한다. 추가 지시는 발견·결정이 생겼을 때 모아 보낸다.
3. 두 도구 모두 필요한 파일·범위만 읽는다. 과거 인계 문서 일괄 출력, 변경 없는 동일 범위 재열람을 피한다. 큰 출력은 파일·행 범위를 줄인다. 필수 규칙의 최초 읽기를 생략하지 않는다.
4. Codex 검증은 필요한 완료 후·병합 후 시점에 모은다. 성공한 검사는 파일 상태가 같으면 반복하지 않는다. 실패·변경·병합 후에는 다시 검증할 수 있다. QA 등 추가 에이전트는 실행 전에 이유·범위·검증 시점을 보고한다. 보고를 사용자 승인으로 간주하지 않는다.

## Codex 위임 계약

사용자에게 먼저 `사용량 계획 <고유ID>: 역할, 담당 경로, 추가 이유, 검증 시점`을 commentary로 보고한다. 이후 `spawn_agent`의 `message` 첫 줄을 아래 형식으로 쓴다. 별도 파라미터를 추가하지 않는다.

```text
USAGE_PLAN {"id":"f1-implementation","paths":["src/components/대상.tsx","tests/대상.test.ts"]}
필요한 결정과 파일 경로, 담당 범위, 산출물을 적는다.
```

- Codex 런타임이 위임 본문을 암호화하는 경우에는 사전 보고에도 `USAGE_PLAN {"id":"고유ID","task_name":"spawn의 작업명","paths":["담당/경로"]}`를 별도 줄로 적는다. 훅은 같은 `task_name`의 assistant 보고 계획을 사용한다. 암호문 본문의 실제 길이·내용은 검증할 수 없으며, 평문 위임은 기존 첫 줄 검사를 유지한다.
- 훅은 대화 기록 끝 128KiB에서 assistant 텍스트의 보고 표식을 확인한다. transcript가 없거나 형식을 인식하지 못하면 위임을 차단한다. 표식은 의미상 보고 품질을 보증하지 않는다.
- 담당 경로는 저장소 내부의 구체적인 파일·디렉터리다. 메인의 해당 경로 읽기와 검증은 위임 종료까지 차단한다.
- Codex 자식 훅도 부모 session_id를 쓰므로 agent_id·transcript 경로로 실행 주체를 구분한다. 실제 런타임은 `task_name`만 반환할 수 있어 `SubagentStart`의 agent_id를 예약에 연결한다. 시작 ID가 확인되기 전 다음 위임은 차단한다. `SubagentStop` 또는 표준 `wait` 완료 상태에서 예약을 해제한다. 단순 대기·interrupt는 종료로 보지 않는다.
- 전체 테스트 전 `사용량 검증 단계: 완료 후 또는 병합 후, 실행 이유`를 보고한다. 같은 파일 상태의 성공 검사는 실행 주체와 무관하게 재사용한다.

## 구현 범위와 한계

- `.harness/usage_guard.py`를 두 도구의 동기식 command 훅으로 실행한다. 모델·네트워크 호출은 없다. 1·2·4번은 Codex 모드에서만 적용한다.
- 상태는 OS 임시 디렉터리 `harness-usage-<git-common-dir 해시>` 아래에 보관한다. worktree 간 검증 기록을 공유하고 파일 잠금으로 중복 실행 경합을 막는다. 사용자 피드백과 규칙은 이 문서에 영구 보관한다. Codex는 Pre/PostToolUse·SubagentStart/Stop·SessionEnd, Claude는 Pre/PostToolUse·PostToolUseFailure에 등록한다. Codex에서 미지원인 PostToolUseFailure에 의존하지 않는다.
- 읽기는 `Read`·`read_file` 및 정적으로 식별되는 `cat/head/tail/sed/rg/grep` 셸 인자를 추적한다. 성공한 읽기의 파일 내용 해시·범위·세션이 같을 때 차단한다. 셸은 명령 문자열 전체를 범위로 사용하므로 다른 표현으로 같은 범위를 읽는 경우는 탐지하지 못한다.
- 이미지 응답의 전송 데이터(`image` 콘텐츠의 data 및 data:image URL)는 텍스트 출력 크기에서 제외한다. 함께 반환된 설명·텍스트는 계속 검사한다.
- 명령 실행 판정은 셸 도구에만 적용한다. 파일 편집 내용과 따옴표로 닫힌 비셸 here-doc의 리터럴 본문을 읽기·테스트 실행으로 오인하지 않는다. 셸 자체에 전달하는 here-doc와 본문 뒤 실제 명령은 계속 검사한다. 동적 Python 실행 등 래퍼 내부는 기존 미지원 범위다.
- 16,000자를 초과하는 도구 출력은 Codex에서 결과를 차단 피드백으로 교체하고, Claude에서는 Bash·Read·MCP의 인식 가능한 출력 형식을 교체한다. Claude의 Write·Edit·MultiEdit·NotebookEdit와 Codex의 apply_patch 응답은 입력 내용을 되돌려 줄 뿐 모델에 보이는 출력이 아니므로 크기 검사에서 뺀다. 미지원 출력 형식은 경고한다. 자동 주입 문맥, 외부 hosted 도구, 동적 셸·스크립트 내부 읽기, 훅을 거치지 않는 특수 경로까지 통제하지는 못한다.
- 검증은 `pnpm/npm test`, `vitest run/--run`, `node --test`, `playwright test`, `pnpm lint/typecheck/test:e2e`를 식별한다. 파일을 명시한 Vitest와 Node 검사는 범위 검사로 허용한다. 동적 래퍼·다른 명령 별칭은 미지원이다.
- 검증 지문은 HEAD와 추적 파일 전체, src/tests/.harness 및 패키지 파일의 비추적 파일 내용으로 계산한다. 환경변수·외부 DB·네트워크 변화는 감지하지 않는다. Bash 훅이 stdout 문자열만 전달하면 다음 호출에서 transcript의 CommandExecution 완료 항목 또는 function_call_output의 종료 코드를 확인한다. 명령·출력은 변경하지 않는다. 종료 상태가 확인되지 않은 같은 읽기는 보류하며, transcript가 없는 임시 세션은 완료 판정에 제한이 있다. 실행 중 검사 예약은 최대 1시간 유지한다.
- Codex는 수정·신규 훅의 정확한 해시를 신뢰해야 실행한다. `/hooks` 또는 공식 설정 API로 검토한 프로젝트 정의만 신뢰 처리하고 새 프로세스의 `hooks/list`에서 확인한다. 신뢰 우회 플래그를 사용하지 않는다.
