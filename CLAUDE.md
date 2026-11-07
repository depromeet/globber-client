# Globber

3D 지구본 기반 여행 기록 서비스의 프론트엔드(Next.js 15 App Router). 백엔드는 별도 저장소이며 `NEXT_PUBLIC_API_BASE_URL`로 호출한다.

## 기본 원칙

- 사용자와의 대화, 문서, 커밋 메시지, 코드 주석은 한국어로 쓴다.
- `git commit` / `push` / PR 생성 / `main` 병합은 사용자가 요청하거나 승인할 때만 한다. **`main` push = 운영 배포.**
- 실제 사용 환경은 모바일(iOS Safari, Android Chrome), 최대 폭 512px이다.
- 검사: `pnpm typecheck`, `pnpm check`, `pnpm test`
- 커밋 규칙: `.claude/skills/git-commit` (Conventional Commits, `.husky/commit-msg`가 검사)

## 규칙 문서

위임·문서 탐색·검증 전 `docs/agent-rules/usage-budget.md`를 읽고 중복 작업 제한을 따른다.

원본은 `docs/agent-rules/`(Codex와 공용)이고, `.claude/rules/`의 심볼릭 링크를 통해 경로가 지정된 규칙은 해당 파일을 다룰 때 자동으로 로드된다. 규칙을 고칠 때는 `docs/agent-rules/`를 수정한다.

| 문서                       | 내용                                             |
| -------------------------- | ------------------------------------------------ |
| `project-structure.md`     | 디렉터리 배치, 기술 스택                         |
| `git-workflow.md`          | 브랜치·커밋·PR 형식, 병렬 작업(worktree) 수칙    |
| `code-conventions.md`      | 네이밍, `type`/화살표 함수, Next 특수 파일 예외  |
| `api.md`                   | services, apiClient, TanStack Query, 타입 네이밍 |
| `hooks.md`                 | 커스텀 훅                                        |
| `styling.md`               | Tailwind v4 토큰, CVA, cn                        |
| `env-ssr.md`               | `config/env.ts`, SSR 호환성                      |
| `mobile-web.md`            | iOS/Android에서 실제로 났던 버그 패턴            |
| `enforcement-placement.md` | 검사를 Hook·pre-commit·테스트 중 어디에 둘지     |

## Task Team 하네스

새 기능, 화면 추가, 요구사항 정의부터 구현·리뷰·QA까지 처리한다.

| 목적        | 위치                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| 전체 진행표 | `.claude/skills/task-team-orchestrator/SKILL.md`                                                                   |
| 팀원        | `.claude/agents/{project-manager, designer, frontend-developer, code-reviewer, security-reviewer, qa-engineer}.md` |
| 산출물      | `artifacts/task-team/{GLB-id}/`                                                                                    |

### 자연어 라우팅 - Task Team

아래 요청이면 `task-team-orchestrator`를 먼저 사용한다.

- "GLB-123 기능 구현해줘", "이 화면 만들어줘", "기능 추가해줘", "요구사항 정리해줘"
- "코드 리뷰해줘", "QA 다시 돌려줘", "보안 검토해줘"
- "이전 결과 기반으로 보완해줘", "특정 단계만 다시 해줘"

## Bug Team 하네스

버그 접수, 원인 분석, 수정, 재발 방지 기록까지 처리한다.

| 목적        | 위치                                                                           |
| ----------- | ------------------------------------------------------------------------------ |
| 전체 진행표 | `.claude/skills/bug-team-orchestrator/SKILL.md`                                |
| 팀원        | `.claude/agents/{bug-reporter, bug-localizer, bug-fixer, postmortem-agent}.md` |
| 산출물      | `artifacts/bug-team/{GLB-id}/`                                                 |

### 자연어 라우팅 - Bug Team

아래 요청이면 `bug-team-orchestrator`를 먼저 사용한다.

- "버그 있어", "GLB-123 버그 고쳐줘", "모바일에서 ~가 안 돼", "에러 나"
- "왜 이렇게 동작해?", "포스트모텀 해줘", "재발 방지해줘"

## 공용 Skill

| Skill                 | 용도                                                   |
| --------------------- | ------------------------------------------------------ |
| `mobile-qa`           | 512px·iOS·Android 에뮬레이션 확인 절차                 |
| `git-commit`          | 커밋 형식·분리·PR 본문 (`/git-commit` 또는 "커밋해줘") |
| `harness-lab`         | 하네스 설계·점검·개선                                  |
| `cross-agent-handoff` | Claude↔Codex·세션 전환 시 인계 파일 작성               |

## Claude-Codex 인계

- Codex 입구는 `AGENTS.md`, Codex 하네스는 `.codex/agents/*.toml`, `.agents/skills/`, `.codex/hooks/`다. Claude 하네스(`.claude/agents`, `.claude/skills`, `.claude/hooks`)와 쌍으로 관리하므로 한쪽을 고치면 짝도 고친다(pre-commit이 검사).
- 모델 또는 세션을 넘길 때만 `cross-agent-handoff`로 `artifacts/work/{work-id}/STATUS.md`, `HANDOFF.md`를 갱신한다.
- 공용 인계 형식 외의 실행 절차는 Codex에 맞추려 하지 않는다.

## 하네스 변경 이력

`docs/agent-harness/CHANGELOG.md` (Claude·Codex·공용 규칙 통합)

## 하네스 수정 규칙

- Agent·Skill(Claude판·Codex판)을 만들거나 고치기 전에 `harness-lab` Skill(`.claude/skills/harness-lab/`)의 `references/agent-team-design.md`(Agent), `orchestrator-artifacts-template.md`(Orchestrator), `skill-authoring-guide.md`(Skill)를 읽고 그 절 구조를 따른다.
- 하네스 누락·drift 점검은 레퍼런스 프로젝트와의 비교로 끝내지 않고 위 템플릿과 `testing-qa-evolution.md`의 하네스 테스트 체크리스트를 기준에 포함한다.
- 필수 절은 `scripts/harnessSpec.test.ts`가 검사한다.
