---
name: task-team-orchestrator
description: >
  globber Task Team 전체 개발 사이클(요구사항 → 디자인 명세 → 구현 → 코드/보안 리뷰 → QA)을 조율한다.
  "GLB-123 기능 구현해줘", "이 화면 만들어줘", "기능 추가해줘", "요구사항 정리해줘", "코드 리뷰해줘", "보안 검토해줘" 같은 요청에 사용한다.
  초기 실행뿐 아니라 "다시 실행", "QA만 다시", "리뷰만 다시", "이전 결과 기반으로 보완", "요구사항 수정 반영" 같은 재실행·부분 수정 요청에도 사용한다.
  버그 수정 요청은 bug-team-orchestrator, 단순 파일 편집은 직접 처리한다.
---

# Task Team Orchestrator

## 목적

globber의 기능 요청을 요구사항 → 디자인 명세 → 구현 → 코드·보안 리뷰 → QA로 나누어 진행하고, 단계마다 파일 산출물을 남겨 다음 단계와 다음 실행이 이어받게 한다. 최종 산출물은 검증을 통과한 `src/` 변경과 `{run}/summary.md`(커밋 메시지·PR 본문 초안 포함)이다.

## 실행 모드

Hybrid. 판단·검토 단계는 Agent Team으로 진행 상태와 발견을 공유하고, 코드를 수정하는 단계는 worktree로 격리한 Subagent로 실행한다(여러 세션·팀이 같은 저장소를 동시에 수정할 수 있기 때문).

| Task                    | 실행 모드                                 | 진행 상태                               | 결과 전달                                  |
| ----------------------- | ----------------------------------------- | --------------------------------------- | ------------------------------------------ |
| T01                     | 단일 흐름 (orchestrator)                  | orchestrator                            | `00-input.md`                              |
| T02, T03, T05, T06, T07 | Agent Team                                | `TaskUpdate` / `TaskGet`                | `SendMessage` + `{run}/` 파일              |
| T04, 재작업             | Subagent (`Agent(isolation: "worktree")`) | orchestrator가 `TaskUpdate`로 대리 갱신 | 반환값 + `impl-notes.md` + worktree 브랜치 |

## 실행 모드 확인

1. run id를 정한다: Jira 번호가 있으면 `GLB-{번호}`, 없으면 `{YYYYMMDD}-{slug}`. `{run}` = `artifacts/task-team/{run id}/`(메인 체크아웃 절대 경로로 다룬다).
2. `{run}`이 없으면 **초기 실행**.
3. 있으면 요청을 해석한다.
   - "처음부터", "새로" → 기존 `{run}`을 `artifacts/archive/task-team/{run id}-{YYYYMMDD}/`로 옮기고 새 실행
   - "QA만", "리뷰만", "요구사항 수정 반영" → 해당 Task부터 부분 재실행 (`{n}` 번호를 올린다)
   - 불명확 → AskUserQuestion으로 "이어서 보완 / 특정 단계 재실행 / 새 실행" 확인
4. `artifacts/bug-team/*/postmortem.md` 중 "상태: 미반영"인 "Task Team 피드백"을 모아 `00-input.md`에 넣는다.
5. 병렬 상황 점검: `git status`, `git worktree list`, `git branch --show-current`. 다른 세션의 미커밋 변경이나 worktree가 보이면 구현 Task는 반드시 worktree 격리로 실행한다.

## 실행 모드별 데이터 전달

| 방식        | 쓰는 곳                               | 기준                                                          |
| ----------- | ------------------------------------- | ------------------------------------------------------------- |
| 태스크 기반 | `TaskCreate`, `TaskUpdate`, `TaskGet` | 작업 상태, 의존 관계, 재할당                                  |
| 메시지 기반 | `SendMessage`                         | 발견, 질문, 충돌, 차단, 완료 알림                             |
| 파일 기반   | `{run}/`                              | 다음 단계가 반드시 읽어야 하는 산출물. 메시지에만 두지 않는다 |
| 반환값 기반 | T04·재작업 Subagent                   | 변경 요약. 판단 근거는 `impl-notes.md`에 남기게 한다          |

메시지 형식:

```md
수신: {agent-name 또는 orchestrator}
유형: 발견 | 질문 | 충돌 | 차단 | 완료
관련 Task:
관련 파일:
내용:
필요한 조치:
```

## Agent Team 구성

| 팀원               | Agent 파일                             | 역할                         | 주요 산출물                |
| ------------------ | -------------------------------------- | ---------------------------- | -------------------------- |
| project-manager    | `.claude/agents/project-manager.md`    | 요구사항·수용 기준           | `requirements.md`          |
| designer           | `.claude/agents/designer.md`           | 화면·컴포넌트 명세           | `design-spec.md`           |
| frontend-developer | `.claude/agents/frontend-developer.md` | 구현 (worktree Subagent)     | `src/`, `impl-notes.md`    |
| code-reviewer      | `.claude/agents/code-reviewer.md`      | 로직·규칙 리뷰               | `code-review-{n}.md`       |
| security-reviewer  | `.claude/agents/security-reviewer.md`  | 보안 리뷰·배포 판정          | `security-review-{n}.md`   |
| qa-engineer        | `.claude/agents/qa-engineer.md`        | 테스트 작성·검사·모바일 확인 | 테스트, `qa-report-{n}.md` |

## Task 등록 계약

| Task             | 담당               | 입력                          | 출력                       | 의존       | 완료 기준                                                  | 메시지 대상                         | 상태 갱신               |
| ---------------- | ------------------ | ----------------------------- | -------------------------- | ---------- | ---------------------------------------------------------- | ----------------------------------- | ----------------------- |
| T01-input        | orchestrator       | 사용자 요청, 티켓, Figma 링크 | `00-input.md`              | -          | 원문, 링크, 승인 지점, 미반영 피드백 정리 (해석 없이)      | -                                   | 작성 완료               |
| T02-requirements | project-manager    | `00-input.md`                 | `requirements.md`          | T01        | 기능 분해, Given-When-Then 수용 기준, edge case, 영향 파일 | orchestrator                        | 시작, 차단, 완료        |
| T03-design       | designer           | `requirements.md`, Figma      | `design-spec.md`           | T02 + 승인 | 컴포넌트·상태·토큰 매핑                                    | project-manager, frontend-developer | 시작, 차단, 완료        |
| T04-implement    | frontend-developer | requirements, design-spec     | `src/`, `impl-notes.md`    | T03        | tsc·check·test 통과                                        | orchestrator, designer              | 시작, 차단, 완료 (대리) |
| T05-code-review  | code-reviewer      | diff, 명세                    | `code-review-{n}.md`       | T04        | 판정, 수용 기준별 충족 여부                                | orchestrator, security-reviewer     | 시작, 차단, 완료        |
| T06-security     | security-reviewer  | diff                          | `security-review-{n}.md`   | T04        | 배포 판정                                                  | orchestrator                        | 시작, 차단, 완료        |
| T07-qa           | qa-engineer        | requirements, diff, 리뷰 결과 | 테스트, `qa-report-{n}.md` | T05, T06   | 수용 기준별 결과, 신규 테스트는 실제 소스 import           | orchestrator                        | 시작, 차단, 완료        |

## Agent Team 실행 흐름

1. T01을 직접 작성한다.
2. `TeamCreate`로 팀을 만들고 `TaskCreate`로 T01~T07을 의존 관계와 함께 등록한다. 팀원은 시작·차단·완료를 `TaskUpdate`로 갱신한다.
3. T02 실행.
4. **🔒 요구사항 승인 게이트**: `requirements.md`의 기능 분해·수용 기준·확인 필요 항목을 요약해 AskUserQuestion으로 승인받는다. 수정 요청이면 project-manager에게 반영시키고 다시 게이트를 거친다.
5. T03 실행. "확인 필요"가 남으면 사용자에게 묻는다.
6. T04 구현 - **worktree 격리**
   - 기본은 `Agent(subagent_type: "frontend-developer", isolation: "worktree", name: "task-{run id}-impl")`로 스폰한다. 다른 세션·팀이 같은 저장소에서 동시에 일할 수 있기 때문이다.
   - 명세가 서로 다른 파일 영역으로 깔끔하게 나뉘면(예: 새 페이지 / 공통 컴포넌트) frontend-developer를 2명까지 나눠 스폰할 수 있다. 각자 파일 범위를 지시문에 명시하고, **`Agent` 호출은 메시지마다 하나씩** 보낸다.
   - 지시문에 넣을 것: `{run}` 절대 경로, 담당 파일 범위, "커밋 금지 - orchestrator가 병합", `docs/agent-rules/git-workflow.md`의 병렬 작업 절 읽기.
   - 스폰 직후 `git worktree list`, `git branch --show-current`로 각 worktree가 기대한 커밋에서 분기됐는지, 메인 체크아웃 브랜치가 그대로인지 확인한다. 어긋나면 `TaskStop`으로 중단하고 메인 체크아웃을 원래 브랜치로 돌린 뒤 다시 스폰한다(`git worktree add` 경합으로 메인 체크아웃에서 작업하도록 폴백되는 경우가 있다).
   - 완료 후 orchestrator가 worktree 브랜치를 작업 브랜치에 병합하고 직접 `git diff`, `pnpm exec tsc --noEmit`, `pnpm check`, `pnpm test`를 돌린다. 구현자의 "완료" 보고를 그대로 믿지 않는다. 충돌은 사용자에게 보고한다. 끝나면 `git worktree remove`.
7. T05와 T06을 **병렬**로 실행한다(읽기 전용). 리뷰 base 커밋을 지시문에 넣는다.
8. **리뷰 재판정 게이트**: orchestrator가 모든 finding을 실제 코드에서 확인한다.
   - 1차 리뷰에서 타당한 finding은 심각도와 관계없이 이번 사이클에서 재작업한다.
   - 2차 이후에는 Medium 이상만 자동 재작업, Low는 AskUserQuestion으로 "이번 사이클 / 백로그" 결정.
   - diff 밖 기존 코드 finding은 자동 재작업하지 않고 사용자에게 결정을 받는다.
   - 기각한 finding은 사유를 `triage-{n}.md`에 남긴다.
   - 재작업은 6번과 같은 방식(worktree)으로 하고, 재리뷰 범위는 이전 finding + 재작업 diff로 한정한다. 재작업은 최대 2회, 그 뒤에도 남으면 사용자에게 보고한다. orchestrator가 직접 고쳐도 되는 경우는 8-1을 따른다.
   - 재작업이 끝나 더 고칠 Medium 이상이 없으면, T07로 가기 전에 사이클 전체 diff(사이클 시작 커밋부터 현재까지)로 T05/T06 최종 리뷰를 1회 실행한다. 파일은 `{n}` 번호 규칙을 따르고 지시문에 "사이클 전체 최종 리뷰"임을 적는다. 최종 리뷰 finding은 2차 이후 기준을 따른다.
   - security-reviewer의 배포 판정(Critical 미수정 시 비승인)과 이 게이트의 재작업 결정은 별개다. reviewer는 배포 가능 여부만, orchestrator는 "이번 사이클 / 백로그"를 정한다. Critical이 남아 있으면 다음 단계로 가지 않는다.
9. T07 실행. 실패면 결함을 frontend-developer에게 재작업으로 넘기고 T05/T06(재작업 diff 한정) → T07을 다시 돈다.
10. Phase 전환 전마다 `TaskGet`으로 완료·차단·지연을 확인한다. 멈춘 팀원은 `SendMessage`로 원인을 묻고, 입력 부족이면 사용자에게 묻고, 역할 과부하면 Task를 쪼개거나 재할당한다. 재할당하면 `TaskUpdate`에 이유와 새 담당자를 남기고 기존 부분 산출물은 보존한다.
11. `summary.md` 작성: 무엇을 만들었나, 변경 파일, 리뷰·QA 결과, 남은 확인 필요, 제안 커밋 메시지(`git-workflow.md` 형식)와 PR 본문 초안.
12. **🔒 커밋·push·PR 승인 게이트**: 사용자가 승인하면 `git-commit` Skill로 진행한다.
13. `improvement-log.md`에 이번 실행에서 하네스가 막혔던 점을 남기고, 반영한 Bug Team 피드백의 포스트모텀 상태를 "반영됨"으로 바꾼다. `TeamDelete`로 팀을 정리한다.
14. **PR 병합 후 정리**: 사용자가 PR이 병합됐다고 알리거나 정리를 지시하면, `git fetch origin` 후 `gh pr view --json state,mergedAt`과 `git branch --merged origin/main`으로 병합이 확인된 로컬 작업 브랜치와 관련 worktree만 `git branch -d`, `git worktree remove`로 정리한다. 병합 확인이 안 된 브랜치와 원격 브랜치는 건드리지 않는다.

### 8-1 재작업 수행자 예외

타당한 finding은 원칙적으로 frontend-developer에게 재작업시킨다. 아래를 **모두** 만족할 때만 orchestrator가 위임 없이 직접 고친다.

- 사용자가 직접 고치라고 지시했거나 승인했다.
- 범위가 단순하고 도메인 판단이 필요 없다(조건문, 예외 처리, 주석·문서).
- 동시 편집 위험이 없다: `git status`에 자신이 만들지 않은 미커밋 변경이 없고, `ListAgents`에 같은 저장소를 쓰는 다른 세션이 없다. 하나라도 해당하면 worktree 격리로 위임한다.

직접 고쳐도 재검증(`tsc`·`check`·`test`)과 재리뷰는 그대로 한다.

## 하이브리드 전환

- 팀 Task(T03)에서 T04 Subagent로 넘어갈 때 팀은 유지하고, 명세는 `{run}/` 파일 경로로 전달한다. Subagent 반환값만 믿지 않고 `impl-notes.md`와 병합 후 재검증 결과로 판단한다.
- T04가 끝나면 orchestrator가 T04를 `TaskUpdate`로 완료 처리한 뒤 T05/T06 팀원을 시작시킨다.
- 다른 팀 구성이 필요해지면 `{run}/handoff.md`에 현재 상태를 남기고 `TeamDelete` 후 새 `TeamCreate`를 한다. 팀을 중첩하지 않는다.

## 도구·검증 계약

- 도구는 실제 제공된 목록을 먼저 확인한다. 원본 절차의 도구가 없으면 현재 도구로 바꾸고, 실행하지 못한 프로토콜은 미검증으로 보고한다.
- Claude 팀원 스폰 지시문에 `필요 도구: Read, Edit, Bash`처럼 역할 정의의 tools와 대조한 선언을 넣는다. Write만 선언하면 `수정 파일: 없음` 또는 대상 경로를 적고, 기존 파일 수정에는 Edit가 필요하다.
- Codex는 실제 제공된 collaboration 도구로 팀원을 호출·조율하고, Task 상태는 `{run}/progress.md`에 남긴다. Claude 전용 도구 이름을 실행한 것으로 보고하지 않는다.
- 요구사항·API 계약·위험한 중간 산출물이 바뀌면 다음 단계 전에 QA에게 해당 경계면만 먼저 점검시킨다. 전체 QA와 별개로 결과를 `{run}`에 기록한다.
- 재작업은 기존 finding과 수정 diff를 검토하고, 사이클 전체 최종 리뷰에서는 CodeRabbit 교차검토를 다시 실행한다. 도구 인증·네트워크 실패는 자체 리뷰 결과와 구분해 기록한다.
- 같은 메인 체크아웃을 쓰는 다른 세션이 확인되면 스테이징·복원·병합 전 대상 파일과 작업을 조율한다. 타인의 변경을 되돌리지 않는다.

## 실패 처리

- 사용자 결정이 필요한 질문은 일반 텍스트가 아니라 AskUserQuestion으로 묻는다.
- 입력이 부족하면 추측하지 않고 묻는다.
- 백엔드 API가 없으면 구현 전에 사용자에게 알리고, mock으로 진행할지 결정받는다.
- 팀원 1명이 멈추면 `TaskGet`으로 확인하고 `SendMessage`로 원인을 물어 1회 재시도한다. 재시도도 실패하면 재할당하거나 사용자에게 영향도를 보고한다.
- 팀원 과반이 실패하면 진행하지 않고 현재 상태와 선택지를 보고한다.
- 리뷰어 간 결과가 충돌하면 한쪽을 지우지 않고 근거를 함께 `triage-{n}.md`에 남긴 뒤 판단한다.
- 커밋·push·PR·`main` 병합은 사람 승인 전에 하지 않는다.

## 산출물 계약

| 파일                     | 만드는 역할        | 다음에 읽는 역할                         | 완료 기준                             |
| ------------------------ | ------------------ | ---------------------------------------- | ------------------------------------- |
| `00-input.md`            | orchestrator       | 모든 팀원                                | 원문·링크·승인 지점·피드백, 해석 없음 |
| `requirements.md`        | project-manager    | designer, frontend-developer, 리뷰어, QA | 수용 기준 Given-When-Then             |
| `design-spec.md`         | designer           | frontend-developer, QA                   | 상태별 표시, 토큰 매핑                |
| `impl-notes.md`          | frontend-developer | 리뷰어, QA                               | 명세와 다른 부분 명시                 |
| `code-review-{n}.md`     | code-reviewer      | orchestrator, QA                         | finding마다 파일:줄 근거              |
| `security-review-{n}.md` | security-reviewer  | orchestrator, QA                         | 배포 판정                             |
| `triage-{n}.md`          | orchestrator       | 재작업자, QA                             | 기각·보류 사유                        |
| `qa-report-{n}.md`       | qa-engineer        | orchestrator                             | 통과·실패·미검증 분리                 |
| `handoff.md` (필요 시)   | orchestrator       | 새 팀, 다음 세션                         | 현재 단계와 다음 행동                 |
| `summary.md`             | orchestrator       | 사용자, 다음 실행                        | 커밋 메시지·PR 본문 초안              |
| `improvement-log.md`     | orchestrator       | 다음 하네스 개선                         | 막힌 점과 다음 수정 후보 1개 이상     |

모든 경로는 `artifacts/task-team/{run id}/` 아래다. 모델·세션을 넘길 때는 `cross-agent-handoff`로 `artifacts/work/`에 인계 파일을 남긴다.

## 테스트 프롬프트

| 유형        | 프롬프트                                     | 기대 결과                                                               |
| ----------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| 정상        | "GLB-130 저장된 지구본 목록에 정렬 추가해줘" | `{run}` 생성, T02 후 요구사항 승인 게이트에서 멈춤                      |
| 애매함      | "이거 좀 더 좋게 만들어줘"                   | 대상 화면·기대 결과를 묻고 `00-input.md`에 확인 필요로 남김             |
| 부분 재실행 | "GLB-130 QA만 다시 돌려줘"                   | 기존 `{run}`을 읽고 T07만 `qa-report-{n+1}.md`로 실행                   |
| 실패 위험   | "리뷰는 건너뛰고 바로 커밋해"                | 리뷰·QA를 생략하지 않거나 생략 위험을 알리고, 커밋은 승인 게이트를 거침 |
| 부정        | "로그인 안 되는 버그 고쳐줘"                 | 이 Skill을 쓰지 않고 bug-team-orchestrator로 보냄                       |
