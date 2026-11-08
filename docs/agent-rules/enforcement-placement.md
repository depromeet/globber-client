# 검사 로직 배치 기준 (Hook / pre-commit / 유닛 테스트)

새 검증 규칙을 추가할 때는 "파일 내용만으로 결론이 나는가, 아니면 지금 실행되려는 명령·세션 상태(tool_input, git status, agent_id 등)를 봐야 하는가"로 위치를 정한다. 파일 내용만 보는 검사는 다시 범위로 나눈다.

- 명령·세션 런타임 상태가 필요 → Hook (Claude `.claude/hooks/`, Codex `.codex/hooks/` 쌍). 예: `git-safety-guard.sh`, `require-isolation-when-dirty.sh`
- 파일 내용만으로 완결되고 이번 커밋(staged 파일)으로 범위를 좁힐 수 있음 → pre-commit(`.lintstagedrc.js`) 또는 `.husky/commit-msg`. 기존 위반과 무관하게 바로 켤 수 있다. 예: `scripts/check-em-dash-in-source.sh`, `scripts/check-agent-harness-sync.sh`, 커밋 메시지 형식
- 파일 내용만으로 완결되고 코드 전체에서 항상 참이어야 하는 불변식 → vitest 테스트(`apps/web/src/**/*.test.ts`). 기존 위반을 먼저 정리해야 켤 수 있다.
- 작성 시점에 막아야 효과가 큰 파일 내용 검사는 Hook으로 먼저 막고, 사람 커밋까지 막도록 pre-commit에도 둔다. 예: em dash
