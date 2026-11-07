# Globber

3D 지구본 기반 여행 기록 서비스의 프론트엔드(Next.js 15 App Router). 백엔드는 별도 저장소이며 `NEXT_PUBLIC_API_BASE_URL`로 호출한다. 이 파일은 Codex의 입구이고, Claude는 `CLAUDE.md`를 읽는다.

## 기본 원칙

- 사용자와의 대화, 문서, 커밋 메시지, 코드 주석은 한국어로 쓴다.
- `git commit` / `push` / PR 생성 / `main` 병합은 사용자가 요청하거나 승인할 때만 한다. **`main` push = 운영 배포.**
- 실제 사용 환경은 모바일(iOS Safari, Android Chrome), 최대 폭 512px이다.
- 검사: `pnpm typecheck`, `pnpm check`, `pnpm test`
- 커밋 규칙: `.agents/skills/git-commit` (Conventional Commits, `.husky/commit-msg`가 검사)

## 공용 에이전트 규칙

위임·문서 탐색·검증 전 `docs/agent-rules/usage-budget.md`를 읽는다. 최소 문맥 위임과 중복 탐색·검증 제한을 따른다.

코드·문서·Git 작업 전에 `docs/agent-rules/README.md`를 읽고, 현재 작업과 관련된 규칙 문서를 읽는다.

## Task Team · Bug Team

| 하네스    | 진행표                                           | 팀원                                                                                                                | 산출물                          |
| --------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Task Team | `.agents/skills/task-team-orchestrator/SKILL.md` | `.codex/agents/{project-manager, designer, frontend-developer, code-reviewer, security-reviewer, qa-engineer}.toml` | `artifacts/task-team/{run id}/` |
| Bug Team  | `.agents/skills/bug-team-orchestrator/SKILL.md`  | `.codex/agents/{bug-reporter, bug-localizer, bug-fixer, postmortem-agent}.toml`                                     | `artifacts/bug-team/{run id}/`  |

- "GLB-123 기능 구현해줘", "이 화면 만들어줘", "코드 리뷰해줘", "QA 다시 돌려줘" → `task-team-orchestrator`
- "버그 있어", "모바일에서 ~가 안 돼", "에러 나", "포스트모텀 해줘" → `bug-team-orchestrator`
- 공용 Skill: `mobile-qa`(모바일 확인 절차), `git-commit`, `cross-agent-handoff`, `harness-lab`

## Claude-Codex 인계 계약

- Claude와 Codex는 각자의 Skill·Agent 흐름으로 작업한다.
- 모델 또는 세션을 실제로 전환할 때만 `artifacts/work/{work-id}/STATUS.md`와 `HANDOFF.md`를 갱신한다. 대화만으로 다음 모델에 필수 정보를 전달하지 않는다.
- `task-team`·`bug-team` 상세 산출물은 그대로 두고, `HANDOFF.md`에는 경로와 핵심 결론만 적는다.
- 인계 문서 작성·검증은 `cross-agent-handoff` Skill. 절차는 `docs/agent-contracts/handoff.md`, 파일 계약은 `artifacts/work/README.md`.

## 하네스 파일 쌍

Claude와 Codex 하네스는 쌍으로 관리한다. 한쪽을 고치면 짝도 고친다(pre-commit이 검사).

| Claude                | Codex                  |
| --------------------- | ---------------------- |
| `.claude/agents/*.md` | `.codex/agents/*.toml` |
| `.claude/skills/**`   | `.agents/skills/**`    |
| `.claude/hooks/*.sh`  | `.codex/hooks/*.sh`    |

## 하네스 변경 이력

`docs/agent-harness/CHANGELOG.md` (Claude·Codex·공용 규칙 통합)

## 하네스 수정 규칙

- Agent·Skill(Claude판·Codex판)을 만들거나 고치기 전에 `harness-lab` Skill(`.agents/skills/harness-lab/`)의 `references/agent-team-design.md`(Agent), `orchestrator-artifacts-template.md`(Orchestrator), `skill-authoring-guide.md`(Skill)를 읽고 그 절 구조를 따른다.
- 하네스 누락·drift 점검은 레퍼런스 프로젝트와의 비교로 끝내지 않고 위 템플릿과 `testing-qa-evolution.md`의 하네스 테스트 체크리스트를 기준에 포함한다.
- 필수 절은 `scripts/harnessSpec.test.ts`가 검사한다.
