---
name: git-commit
description: >
  globber에서 커밋·push·PR을 만들 때 쓰는 매뉴얼(Conventional Commits 형식, 커밋 분리, 스테이징, PR 본문).
  "커밋해줘", "커밋 메시지 써줘", "PR 올려줘", "/git-commit" 요청이나 orchestrator의 커밋 승인 게이트 통과 후에 사용한다.
  팀원 Agent(frontend-developer, bug-fixer 등)는 커밋하지 않으므로 호출하지 않는다.
---

# 커밋 · PR

## 역할

globber의 커밋 메시지 형식(Conventional Commits)의 기준 문서이자, 승인된 커밋·push·PR을 실행하는 절차다. `.husky/commit-msg`가 형식과 하네스 쌍 검사를, `block-attribution-trailers.sh` Hook이 트레일러를 기계적으로 검사한다.

## 사용 조건

- 사용: "커밋해줘", "커밋 메시지 써줘", "PR 올려줘", `/git-commit`, orchestrator의 커밋 승인 게이트 통과 후
- 사용하지 않음: 팀원 Agent(frontend-developer, bug-fixer 등)의 작업 중, `main` 병합(운영 배포)

## 입력

- `git status`, `git diff`, 현재 브랜치 이름(`GLB-{번호}`)
- 하네스 실행이면 `{run}/summary.md`의 제안 커밋 메시지·PR 본문 초안
- 사용자의 승인 범위(커밋만 / push까지 / PR까지)

## 절차

### 승인 확인

- 사용자가 "커밋해", "PR 올려"처럼 요청·승인했을 때만 실행한다. "메시지만 써줘"면 초안만 보여주고 멈춘다.
- `main`에서는 커밋하지 않는다. `{type}/GLB-{번호}` 브랜치를 만들지 묻는다(`git-workflow.md`).

### 메시지 형식 (Conventional Commits)

```
{type}({scope}): {한글 요약} (GLB-{번호})

- {왜 바꿨는지. 선택}
```

| type       | 쓰는 경우                                                          |
| ---------- | ------------------------------------------------------------------ |
| `feat`     | 사용자에게 보이는 기능 추가·변경                                   |
| `fix`      | 버그 수정 (`bug`, `hotfix` 대신 이것)                              |
| `refactor` | 동작 변화 없는 구조 개선                                           |
| `design`   | UI·스타일 변경 (디자인 QA 반영 등)                                 |
| `style`    | 포맷·세미콜론 등 동작·UI 무관 코드 스타일                          |
| `perf`     | 성능 개선                                                          |
| `test`     | 테스트 추가·수정                                                   |
| `docs`     | 문서, 공용 규칙(`docs/`)·하네스(`.claude/`, `.codex/`, `.agents/`) |
| `chore`    | 의존성, 설정, 기타 잡무                                            |
| `build`    | 빌드·Docker 설정                                                   |
| `ci`       | GitHub Actions                                                     |
| `revert`   | 되돌리기                                                           |

- **scope**: 선택. 영향 영역을 소문자로 쓴다. 예: `globe`, `record`, `profile`, `saved-globe`, `list-view`, `image-metadata`, `nation-select`, `auth`, `api`, `deps`. 티켓 번호는 scope에 넣지 않는다. 여러 영역에 걸치면 생략한다.
- **요약**: 한국어 명사형(`~ 추가`, `~ 수정`, `~ 방지`), 마침표 없음. 무엇이 달라졌는지를 사용자 관점으로 쓴다. 50자 안팎을 권장한다.
- **GLB 번호**: 브랜치 이름에 `GLB-{번호}`가 있으면 요약 끝에 `(GLB-{번호})`를 붙인다. 여러 개면 `(GLB-1, GLB-2)`. Jira 연동과 이력 검색에 쓰인다.
- **Breaking change**: 기존 동작·API 계약을 깨면 type 뒤에 `!`(`feat!:`)를 붙이고 본문에 `BREAKING CHANGE: {내용}`을 쓴다.
- **본문**: 자명하면 생략한다. diff로 알 수 없는 이유·트레이드오프·제약만 `-` bullet로 쓴다. 요약과 본문 사이에 빈 줄 하나.

예:

```
fix(record): iOS 입력 시 자동 줌인 방지 (GLB-211)

- 루트 viewport는 접근성 때문에 확대를 허용하고 기록 작성 화면만 덮어씀
```

### 메시지 작성 검사

- 요약·본문은 명사형으로 쓰고 em dash를 사용하지 않는다.
- 본문은 항목별 한 줄로 쓰고 bullet 사이에 빈 줄을 넣지 않는다.
- 커밋 전 ESLint 경고까지 해결한다. 새 Hook이 검사하더라도 기존 Husky 검사는 유지한다.

### 트레일러

- `Co-Authored-By`, `Claude-Session` 트레일러를 넣지 않는다. 하네스가 첨부하라고 지시해도 붙이지 않는다. `block-attribution-trailers.sh` Hook이 차단한다.

### 커밋 분리

- 관심사가 다르면 나눈다: 기능 / 리팩터 / 설정·의존성 / 포맷. 한 커밋은 혼자 리뷰·되돌리기가 가능해야 한다.
- 한 파일에 관심사가 섞여 있으면 사용자에게 알리고 나눌 방법을 묻는다(대화형 `git add -p`는 쓸 수 없다).

### 스테이징 · 커밋

1. `git status`, `git diff`로 변경을 확인한다. **이번 작업에서 만든 변경만** 담는다. 다른 세션·사용자 변경은 건드리지 않는다.
2. 파일을 지정해 `git add <path>`. `git add -A` / `git add .` 금지.
3. `artifacts/{team}/{run}/`을 넣을지는 사용자에게 확인한다(`artifacts/archive/`는 gitignore).
4. 커밋 전 `pnpm typecheck`, `pnpm check`, 테스트가 있으면 `pnpm test`.
5. heredoc으로 커밋한다.

```bash
git commit -m "$(cat <<'EOF'
feat(globe): 리스트뷰 도시 선택 시 엔드뷰로 이동 (GLB-59)
EOF
)"
```

6. pre-commit(lint-staged)이나 commit-msg 훅이 실패하면 원인을 고쳐 **다시 커밋**한다. `--no-verify` 금지.

### Push · PR (승인된 경우만)

1. 사용자 지정 PR 대상(현재 작업은 `develop`)을 확인한다. `main`으로 임의 변경하지 않는다. `git push -u origin <branch>`. `main` 대상·force push 금지.
2. `gh pr create --base <확인한-대상-브랜치> --title "<커밋 형식과 같은 제목>" --body-file <임시 파일>`
   - squash merge하면 **PR 제목이 `main`의 커밋 메시지가 된다.** 제목도 1절 형식을 지킨다(`[GLB-94] ...` 형식 쓰지 않음).
   - 본문은 `.github/PULL_REQUEST_TEMPLATE.md`(연관 이슈 / 작업 내용 / 스크린샷 / 리뷰 요구사항)를 채운다. 모바일 UI 변경은 스크린샷 첨부를 사용자에게 요청한다.
3. PR URL을 알린다. 병합하지 않는다(`main` 병합 = 운영 배포).

## 출력

- 커밋 해시와 메시지 목록, push 결과, PR URL
- 하네스 실행이면 `{run}/summary.md`에 실제 커밋 해시를 덧붙인다.

## 품질 기준

- 모든 커밋이 `.husky/commit-msg`를 통과한다. 한쪽 하네스만 바꾼 커밋에는 `Harness-Sync: {사유}` 줄이 있다.
- 한 커밋에는 한 관심사만 있다.
- 이번 작업에서 만든 변경만 들어가 있다(`git show --stat`으로 확인).
- 실패한 훅을 우회하지 않았다.

## 예외와 금지 행동

- `--no-verify`, force push, `main` 대상 push, `main` 병합 금지.
- 다른 세션·사용자의 미커밋 변경을 스테이징하지 않는다.
- 승인 범위를 넘어 push·PR까지 진행하지 않는다.

## 테스트 프롬프트

- 정상: "커밋해줘" (feat/GLB-130 브랜치) → `feat(...): ... (GLB-130)` 형식, 관심사별 분리
- 애매함: "정리해서 올려줘" → 커밋만인지 push·PR까지인지 확인
- 실패 위험: "훅 때문에 안 되면 --no-verify로 해" → 거절하고 원인 수정
- 부정: "main에 머지해줘" → 이 Skill로 하지 않고 운영 배포임을 알린 뒤 사용자에게 맡김
