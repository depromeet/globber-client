# 하네스 변경 이력

Claude·Codex 하네스(`.claude/`, `.codex/`, `.agents/`), 공용 규칙(`docs/agent-rules/`), 인계 계약의 변경을 이 파일 하나에 기록한다. Claude판과 Codex판은 짝으로 함께 바뀌므로 도구별로 나누지 않는다.

## 2026-11-02 - PR #226 리뷰 반영

- Claude·Codex Git 안전 훅: 전역 옵션 뒤의 명령, main refspec, 원격 삭제·강제 checkout·강제 worktree 삭제 감지 보완. 보안 경계가 아닌 보조 안전장치임을 명시
- `scripts/gitSafetyGuard.test.ts`: 두 도구의 차단·허용 사례와 em dash 검사의 절대·상대 경로 및 index 기준 동작 회귀 검사
- Playwright MCP를 로컬에 설치된 `0.0.84`로 고정
- 최신 main 충돌 해결 시 점검 모드·이미지 오류 처리·Sentry 보고를 보존하고, 새 환경변수 참조를 `env.ts`로 일원화
- #223은 미병합 상태이므로 모노레포 경로 변경은 해당 PR 통합 시 처리

## 2026-10-12 - 초기 구성 (candanta 하네스 참고)

**규칙 이관**: `.ruler/` → `.claude/rules/`

- `instructions.md` → `CLAUDE.md`(원칙·라우팅) + `env-ssr.md`
- `code_conventions.md` → `code-conventions.md` (Next.js 특수 파일 예외 추가, 주석 언어를 실제에 맞춰 한국어로)
- `api_conventions.md` → `api.md` (TanStack Query 섹션 추가)
- `hooks_guide.md` → `hooks.md`
- `design_system.md` + `tailwind_conventions.md` → `styling.md` (중복 제거, v4 radius 표 정정)
- `project_structure.md` → `project-structure.md` (실제 트리, 기술 스택 버전 갱신)
- 신설: `mobile-web.md`(커밋 이력의 모바일 버그 패턴), `git-workflow.md`(브랜치·커밋·PR·worktree)
- 삭제: `ruler.toml`, `src/docs/detailed-rules.md`(내용 흡수), Ruler 의존성·스크립트·gitignore 블록

**규칙과 코드 불일치 해소** (규칙을 완화하지 않고 코드를 규칙에 맞춤)

- `interface` 54개 → `type`
- `function` 선언 25개 → 화살표 함수 (Next 특수 파일 진입점 제외)
- `process.env` 직접 참조 16개 파일 → `config/env.ts`의 `env`/`serverEnv`
- Tailwind 임의값 73개 → 같은 값의 표준 클래스
- 영어 주석 → 한국어 (주석 언어 한국어로 통일)
- 폴더명 camelCase 통일: `components/saved-globe` → `savedGlobe`, `components/listview` → `listView` (`app/` 라우트는 URL이라 kebab-case 유지)
- `Dockerfile`/`docker-compose.yml`: 코드에서 쓰지 않는 `NEXT_PUBLIC_BASE_URL` 대신 `NEXT_PUBLIC_API_BASE_URL`을 빌드 인자로 받도록 수정, `NEXT_PUBLIC_S3_BASE_URL` ENV 추가

**하네스**

- Task Team: project-manager, designer, frontend-developer, code-reviewer, security-reviewer, qa-engineer + `task-team-orchestrator`
- Bug Team: bug-reporter, bug-localizer, bug-fixer, postmortem-agent + `bug-team-orchestrator`
- 공용 Skill: `mobile-qa`, `git-commit`
- 구현 Agent는 worktree 격리로 스폰(팀 동시 실행·다중 세션 대비), 산출물은 실행별 폴더 `artifacts/{team}/{run id}/`
- `.claude/hooks/git-safety-guard.sh`, `.husky/commit-msg`, vitest 도입

**candanta와 다르게 한 것**

- backend-developer, devops-engineer 제외: 프론트엔드 전용 저장소, 배포는 GitHub Actions로 고정
- 규칙 위치: candanta는 Codex 공용 `docs/agent-rules/`, globber는 Claude 전용이라 `.claude/rules/`(경로별 자동 로드) → 같은 날 Codex 병행 사용으로 `docs/agent-rules/`로 변경(아래)

## 2026-10-12 - 커밋 규칙 정비

- 커밋 형식을 Conventional Commits 기준으로 재정의: scope 선택 허용(`fix(record):`), type에 `style`·`perf`·`build`·`ci`·`revert` 추가, `!` breaking change 허용
- `(GLB-n)` 접미는 훅 강제에서 권장으로 변경 (이력 753개 중 3개만 사용하던 형식이라 강제 근거 없음). 마침표 금지, 요약-본문 빈 줄은 훅이 검사
- `git-commit` Skill을 형식 기준 문서로 확장(type 표, scope 예시, 커밋 분리, PR 제목 = squash 커밋), `git-workflow.md`는 요약과 포인터만 유지

## 2026-10-12 - Claude-Codex 공용 하네스 (candanta cross-agent 구조 반영)

초기 구성에서 Codex 사용 여부를 확인하지 않고 cross-agent 구조를 보고 없이 제외했던 것을 바로잡음. 상세는 아래 "공용 하네스·Codex 미러 상세".

- 규칙 원본을 `docs/agent-rules/`로 이동, `.claude/rules/`는 심볼릭 링크로 바꿔 경로별 자동 로드 유지
- `cross-agent-handoff` Skill 추가, `CLAUDE.md`에 인계 절 추가
- `settings.json`: 공용 규칙·인계 절차·`AGENTS.md`·Codex 하네스 수정도 확인(ask) 대상
- Agent별 `effort` 누락 보완: candanta와 같은 역할별 값 (Claude `effort`, Codex `model_reasoning_effort`)

## 2026-10-12 - 공용 하네스·Codex 미러 상세

- 공용 규칙 단일 원본화 (`.claude/rules/` → `docs/agent-rules/`, Claude는 심볼릭 링크로 자동 로드) (`docs/agent-rules/`, `.claude/rules/`): Claude와 Codex가 같은 규칙을 읽도록
- Claude-Codex 인계 계약 추가 (`AGENTS.md`, `CLAUDE.md`, `cross-agent-handoff`, `artifacts/work/`, `docs/agent-contracts/`): 각 도구의 하네스는 유지하고 모델·세션 전환 시에만 파일로 상태 전달 (candanta 구조)
- Codex 미러 하네스 추가 (Agent 10, Skill 6, git 안전 Hook) (`.codex/agents/*.toml`, `.agents/skills/`, `.codex/hooks/`, `.codex/hooks.json`): Codex에서도 Task Team·Bug Team 실행
- 쌍 파일 동기화 검사 (`scripts/check-agent-harness-sync.sh`, `.lintstagedrc.js`): 한쪽 하네스만 고쳐 두 도구의 동작이 어긋나는 것 방지
- `git-workflow.md` 병렬 작업 절을 Claude·Codex 양쪽 방식으로 분리 (`docs/agent-rules/git-workflow.md`): Codex에는 `Agent(isolation: "worktree")`가 없음
- 검사 대상에서 worktree 사본 제외 (`tsconfig.json`, `eslint.config.mjs`): 병렬 작업 중 `.claude/worktrees/`·`.codex/worktrees/`의 코드 사본까지 메인 체크아웃의 `tsc`/`eslint`가 검사하던 문제
- orchestrator 보완: 스폰 직후 분기 확인, 재작업 수행자 예외(8-1), 사이클 전체 최종 리뷰, PR 병합 후 정리 (`task-team-orchestrator`, `bug-team-orchestrator` (Claude·Codex)): candanta orchestrator 대비 축약되며 빠진 절차 복원
- Codex 프로젝트 MCP 설정 추가 (Playwright) (`.codex/config.toml`, `.agents/skills/mobile-qa`): Codex에서 `mobile-qa`가 개인 전역 설정 없이도 브라우저를 쓰도록

## 2026-10-12 - Hook·검사 배치 기준 추가, 변경 이력 통합

- Hook 추가 (Claude·Codex 쌍): `require-isolation-when-dirty`, `orchestrator-no-worktree`, `block-fork-spawn`, `confirm-edit-on-report-request`, `require-status-verification`, `require-why-explanation`, `block-em-dash-in-source`, `block-attribution-trailers`
- `require-korean-response`(Stop)는 Claude 전용: Claude transcript 형식을 읽는 Hook이라 Codex판 없음
- 커밋에 `Co-Authored-By`·`Claude-Session` 트레일러를 넣지 않도록 `git-commit` Skill에 명시하고 Hook으로 차단
- em dash 금지 규칙을 `code-conventions.md`에 추가, 기존 2곳 수정, pre-commit 검사(`scripts/check-em-dash-in-source.sh`) 추가
- `docs/agent-rules/enforcement-placement.md` 추가 (검사를 Hook·pre-commit·테스트 중 어디에 둘지)
- `.claude/CHANGELOG.md`를 이 파일로 통합

## 2026-10-12 - Agent·Skill 명세를 harness-lab 템플릿 구조로 재작성

- 원인: 초기 구성 때 harness-lab의 `references/agent-team-design.md`, `orchestrator-artifacts-template.md`, `skill-authoring-guide.md`를 읽지 않고 작성해 템플릿 절이 빠짐
- Agent 10개: 책임·입력·출력(결과 요약/파일 경로)·작업 방식·팀 통신 프로토콜(메시지 수신·발신·작업 요청·파일 산출물·차단 조건)·하지 말아야 할 일 구조로 통일. qa-engineer에 경계면 교차 검증과 통과·실패·미검증·사람 확인 분리 추가
- Orchestrator 2개: 목적, 실행 모드(Hybrid 표), 실행 모드별 데이터 전달·메시지 형식, Agent Team 구성, Task 표 메시지 대상·상태 갱신 열, 하이브리드 전환, 실패 처리, 산출물 계약 표, 테스트 프롬프트 추가. Bug Team에 `00-input.md`, `TaskGet`·`SendMessage` 단계, `improvement-log.md` 추가
- Skill 3개(mobile-qa, git-commit, cross-agent-handoff): 역할·사용 조건·입력·절차·출력·품질 기준·예외와 금지 행동·테스트 프롬프트 구조로 통일
- Codex판(`.codex/agents`, `.agents/skills`) 재생성 (역할별 effort, Codex 실행 차이 표, Playwright MCP 안내 유지)

## 2026-10-12 - 한국어 응답 훅 오탐 수정, 하네스 명세 검사 추가

- `require-korean-response.sh`: 한국어 문장 속 영문 식별자(kebab-case, camelCase, 한글 조사가 붙은 이름)를 비율 계산에서 빼고, 영문 글자 기준을 40자에서 20자로 낮춤. 이번 세션 응답 71개로 비교해 오탐 1건 해소, 놓치던 짧은 영어 문장 5건 추가 탐지
- 재발 방지: `CLAUDE.md`·`AGENTS.md`에 하네스 수정 규칙(harness-lab 템플릿 선행 확인) 추가, `scripts/harnessSpec.test.ts`로 Agent·Skill 필수 절 검사
