# artifacts

Claude Code·Codex 하네스(Task Team / Bug Team)가 실행 중에 남기는 산출물입니다. 다음 단계와 다음 실행은 대화가 아니라 이 파일들을 읽습니다.

| 경로                                  | 만드는 쪽                | 내용                                                                |
| ------------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| `task-team/{run id}/`                 | `task-team-orchestrator` | 기능 개발 1회 실행 (요구사항 → 명세 → 구현 노트 → 리뷰 → QA → 요약) |
| `bug-team/{run id}/`                  | `bug-team-orchestrator`  | 버그 1건 처리 (티켓 → 원인 → 수정 → 포스트모텀 → 요약)              |
| `work/{work-id}/`                     | `cross-agent-handoff`    | Claude↔Codex·세션 전환 시 인계 상태 (`work/README.md`)              |
| `archive/{team}/{run id}-{YYYYMMDD}/` | orchestrator             | "처음부터 다시" 실행 시 이전 결과 보관 (git 미추적)                 |

`{run id}`는 Jira 번호(`GLB-123`)이고, 번호가 없으면 `{YYYYMMDD}-{slug}`입니다. 실행 단위로 폴더가 나뉘므로 여러 세션·팀이 동시에 실행해도 서로 덮어쓰지 않습니다.

## 실행별 파일

**task-team/{run id}/**: `00-input.md`, `requirements.md`, `design-spec.md`, `impl-notes.md`, `code-review-{n}.md`, `security-review-{n}.md`, `triage-{n}.md`, `qa-report-{n}.md`, `screenshots/`, `handoff.md`(필요 시), `summary.md`, `improvement-log.md`

**bug-team/{run id}/**: `00-input.md`, `ticket.md`, `localize.md`, `fix.md`, `postmortem.md`, `screenshots/`, `handoff.md`(필요 시), `summary.md`, `improvement-log.md`

## 다음 실행이 읽는 것

- task-team-orchestrator는 시작할 때 `bug-team/*/postmortem.md`에서 "상태: 미반영"인 Task Team 피드백을 모아 반영합니다.
- 같은 run id로 다시 요청하면 기존 폴더를 보고 부분 재실행 / 이어서 보완 / 새 실행 중 하나로 분기합니다.
