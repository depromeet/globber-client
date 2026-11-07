# 공용 에이전트 규칙

- 확인한 사실·추론·미검증을 구분하고, 상태를 보고하기 전 실제 파일·도구 결과를 확인한다.
- 역할·스킬·Hook의 Claude/Codex 쌍은 같은 변경에서 관리한다. 정적 검사 통과와 실제 세션 로딩을 구분한다.
- 하네스 적용 범위와 검증 결과는 `docs/agent-harness/reference-update.md`를 읽는다.

Claude와 Codex가 코드·문서·Git 작업 전에 읽는 규칙의 단일 원본이다. 도구별 권한·Hook·Agent 설정은 `.claude/`, `.codex/`에 둔다.

- Claude: `.claude/rules/`의 심볼릭 링크로 자동 로드된다(`paths:`가 있으면 해당 파일을 다룰 때만).
- Codex: `AGENTS.md`의 안내에 따라 작업과 관련된 문서를 직접 읽는다.
- 새 규칙 파일을 추가하면 `.claude/rules/`에 심볼릭 링크도 만든다: `ln -s ../../docs/agent-rules/{name}.md .claude/rules/`

| 규칙                       | 읽는 시점                                                      |
| -------------------------- | -------------------------------------------------------------- |
| `project-structure.md`     | 파일 배치, 폴더 이름, 기술 스택을 판단할 때                    |
| `code-conventions.md`      | `apps/web/src/` TypeScript·React 코드를 쓰거나 고칠 때         |
| `api.md`                   | `services/`, `apiClient`, TanStack Query, API 타입을 다룰 때   |
| `hooks.md`                 | 커스텀 훅을 만들거나 고칠 때                                   |
| `styling.md`               | Tailwind 클래스, 디자인 토큰, CVA, 접근성                      |
| `env-ssr.md`               | 환경변수, `config/env.ts`, SSR·hydration, Dockerfile 빌드 인자 |
| `mobile-web.md`            | 모바일 UI, 입력·이미지·드래그·키보드 동작                      |
| `git-workflow.md`          | 브랜치, 커밋, PR, worktree 병렬 작업 전                        |
| `usage-budget.md`          | 위임·문서 탐색·검증 전                                         |
| `enforcement-placement.md` | 검사를 Hook·pre-commit·테스트 중 어디에 둘지 정할 때           |
