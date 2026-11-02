# Git 워크플로

## 고위험 행동

- `git commit`, `git push`, PR 생성, `main` 병합은 **사용자가 명시적으로 요청하거나 승인했을 때만** 실행한다.
- **`main`에 push되면 GitHub Actions가 바로 운영 배포한다**(`.github/workflows/deploy.yml`). `main` 직접 push 금지, PR로만 병합한다.
- `--no-verify`, `push --force`, `reset --hard`, `clean -f`, `checkout -- .`, `stash drop/clear`, `branch -D`는 사용자 승인 없이 쓰지 않는다(`git-safety-guard.sh` Hook이 차단: Claude `.claude/hooks/`, Codex `.codex/hooks/`).
- 자신이 만들지 않은 미커밋 변경(`git status`)은 건드리지 않는다. 다른 세션이나 사용자의 작업일 수 있다.

Git 안전 Hook은 알려진 명령 패턴을 감지하는 보조 안전장치이며, 셸 문법 전체를 해석하는 보안 경계가 아니다. Hook 통과 여부와 관계없이 위 승인 규칙을 따른다.

## 브랜치

`{type}/GLB-{번호}` - `main`에서 분기한다.

| type       | 용도                          |
| ---------- | ----------------------------- |
| `feat`     | 기능                          |
| `bug`      | 버그 수정                     |
| `task`     | 기타 작업(설정, 리팩터, 문서) |
| `refactor` | 동작 변경 없는 구조 개선      |

## 커밋 메시지 · PR

형식과 절차는 `git-commit` Skill(Claude `.claude/skills/git-commit/`, Codex `.agents/skills/git-commit/`, Conventional Commits)가 기준이다. 요약:

- `{type}({scope}): {한글 요약} (GLB-{번호})` - scope 선택, 마침표 없음, 요약과 본문 사이 빈 줄
- type: `feat`, `fix`, `refactor`, `design`, `style`, `perf`, `test`, `docs`, `chore`, `build`, `ci`, `revert`
- `.husky/commit-msg`가 형식을 검사한다. PR 제목도 같은 형식(squash merge 시 `main` 커밋 메시지가 된다).
- 커밋 전 `pnpm exec tsc --noEmit`, `pnpm check`, `pnpm test` 통과. 훅 실패를 우회하지 않는다.
- CodeRabbit 리뷰 지적은 실제 코드를 열어 타당성을 확인한 뒤 반영하거나, 기각 사유를 답글로 남긴다.

## 병렬 작업 (worktree)

여러 세션·팀이 동시에 같은 저장소를 수정할 수 있다.

1. 작업 전 `git status`, `git worktree list`, `git branch --show-current`로 다른 작업 흔적을 확인한다.
2. 코드를 수정하는 Agent는 orchestrator가 격리된 worktree에서 실행한다. 팀원 Agent가 스스로 worktree를 만들거나 옮기지 않는다.
   - Claude: `Agent(..., isolation: "worktree")`로 스폰한다. `EnterWorktree` 직접 호출 금지. `isolation: "worktree"` 호출은 한 메시지에 하나씩 보낸다(`git worktree add` 경합 방지).
   - Codex: orchestrator가 `git worktree add ../globber-{run id} -b {branch}-{run id}`로 만든 경로에서 팀원을 실행한다. 같은 체크아웃에서 두 팀원이 동시에 코드를 고치지 않는다.
3. 격리 worktree는 현재 HEAD에서 분기한다(Claude는 `.claude/settings.json`의 `worktree.baseRef: "head"`). 미커밋 산출물은 포함되지 않으므로 worktree 안의 Agent에게는 산출물을 메인 체크아웃의 절대 경로로 읽게 한다.
4. 같은 파일을 수정하는 작업끼리는 순차 실행한다.
5. 병합은 orchestrator가 하고, 병합 후 `tsc`/`check`/`test`를 직접 다시 돌린다. 충돌은 임의로 한쪽을 고르지 않고 사용자에게 보고한다.
