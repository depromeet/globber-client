---
name: bug-team-orchestrator
description: >
  globber Bug Team 버그 처리 흐름(티켓 정리 → 원인 분석 → 수정·회귀 테스트 → 포스트모텀)을 조율한다.
  "버그 있어", "GLB-123 버그 고쳐줘", "모바일에서 ~가 안 돼", "에러 나", "왜 이렇게 동작해?", "포스트모텀 해줘", "재발 방지해줘" 같은 요청에 사용한다.
  같은 버그 추가 정보, "수정 다시", "포스트모텀만 다시", "이전 분석 기반으로 보완" 같은 재실행 요청에도 사용한다.
  새 기능 구현은 task-team-orchestrator를 사용한다.
---

# Bug Team Orchestrator

## Codex 실행 차이

이 진행표는 Claude판(`.claude/skills/bug-team-orchestrator/SKILL.md`)과 쌍이다. Codex에 없는 Claude 도구는 아래처럼 바꿔 실행한다.

| Claude                                  | Codex                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `TeamCreate` / `TeamDelete`             | 팀 생성·정리 없이 `.codex/agents/*.toml` 팀원을 서브에이전트로 호출              |
| `TaskCreate` / `TaskUpdate` / `TaskGet` | `{run}/progress.md`에 Task 표(담당, 상태, 차단 사유)를 두고 단계마다 갱신        |
| `SendMessage`                           | 팀원 호출 지시문과 결과 보고, 산출물 파일로 전달                                 |
| `Agent(..., isolation: "worktree")`     | `docs/agent-rules/git-workflow.md` 병렬 작업 절의 Codex 방식(`git worktree add`) |
| `TaskStop`                              | 해당 서브에이전트 실행 중단                                                      |
| `ListAgents`                            | `git worktree list`와 사용자 확인으로 다른 세션 여부 판단                        |
| `AskUserQuestion`                       | 현재 제공된 사용자 질문 도구를 우선 사용하고, 없으면 선택지를 제시해 답을 기다림 |

## 목적

globber 버그를 티켓 정리 → 원인 분석 → 수정·회귀 테스트 → 포스트모텀으로 처리한다. 증상이 아니라 근본 원인과 같은 원인을 공유하는 모든 호출처를 고치고, 재발 방지안을 Task Team과 규칙 문서로 되돌린다. 최종 산출물은 검증을 통과한 수정과 `{run}/summary.md`다.

## 실행 모드

Hybrid. 분석·기록 단계는 Agent Team, 코드를 수정하는 T03은 worktree로 격리한 Subagent로 실행한다.

| Task          | 실행 모드                                 | 진행 상태                               | 결과 전달                           |
| ------------- | ----------------------------------------- | --------------------------------------- | ----------------------------------- |
| T01, T02, T04 | Agent Team                                | `TaskUpdate` / `TaskGet`                | `SendMessage` + `{run}/` 파일       |
| T03           | Subagent (`Agent(isolation: "worktree")`) | orchestrator가 `TaskUpdate`로 대리 갱신 | 반환값 + `fix.md` + worktree 브랜치 |

## 실행 모드 확인

1. run id: `GLB-{번호}` 또는 `{YYYYMMDD}-{slug}`. `{run}` = `artifacts/bug-team/{run id}/`(메인 체크아웃 절대 경로).
2. `{run}`이 없으면 초기 실행. 있으면:
   - 추가 정보 → T01 티켓 갱신부터
   - "수정 다시" → T03부터, "포스트모텀만" → T04만
   - "처음부터" → `artifacts/archive/bug-team/{run id}-{YYYYMMDD}/`로 옮기고 새 실행
   - 불명확 → AskUserQuestion으로 "이어서 보완 / 특정 단계 재실행 / 새 실행" 확인
3. 병렬 상황 점검: `git status`, `git worktree list`, `git branch --show-current`.

## 실행 모드별 데이터 전달

| 방식        | 쓰는 곳                               | 기준                                                          |
| ----------- | ------------------------------------- | ------------------------------------------------------------- |
| 태스크 기반 | `TaskCreate`, `TaskUpdate`, `TaskGet` | 작업 상태, 의존 관계, 재할당                                  |
| 메시지 기반 | `SendMessage`                         | 중복 발견, 탐색 범위 막힘, 범위 확대, 완료 알림               |
| 파일 기반   | `{run}/`                              | 다음 단계가 반드시 읽어야 하는 산출물. 메시지에만 두지 않는다 |
| 반환값 기반 | T03 Subagent                          | 변경 요약. 판단 근거는 `fix.md`에 남기게 한다                 |

메시지 형식은 task-team-orchestrator의 "실행 모드별 데이터 전달" 절과 같다(수신 / 유형 / 관련 Task / 관련 파일 / 내용 / 필요한 조치).

## Agent Team 구성

| 팀원             | Agent 파일                            | 역할                                  | 주요 산출물      |
| ---------------- | ------------------------------------- | ------------------------------------- | ---------------- |
| bug-reporter     | `.codex/agents/bug-reporter.toml`     | 티켓 정리, 중복 확인                  | `ticket.md`      |
| bug-localizer    | `.codex/agents/bug-localizer.toml`    | 근본 원인, 영향 호출처                | `localize.md`    |
| bug-fixer        | `.codex/agents/bug-fixer.toml`        | 수정, 회귀 테스트 (worktree Subagent) | `src/`, `fix.md` |
| postmortem-agent | `.codex/agents/postmortem-agent.toml` | 재발 방지안                           | `postmortem.md`  |

## Task 등록 계약

| Task           | 담당             | 입력                                   | 출력             | 의존 | 완료 기준                                                        | 메시지 대상  | 상태 갱신               |
| -------------- | ---------------- | -------------------------------------- | ---------------- | ---- | ---------------------------------------------------------------- | ------------ | ----------------------- |
| T01-triage     | bug-reporter     | 버그 설명, 기존 티켓                   | `ticket.md`      | -    | 심각도, 환경, 재현 단계, 중복 판정                               | orchestrator | 시작, 차단, 완료        |
| T02-localize   | bug-localizer    | `ticket.md`                            | `localize.md`    | T01  | 결함 위치, 근본 원인, 모든 영향 호출처, 수정 방향                | orchestrator | 시작, 차단, 완료        |
| T03-fix        | bug-fixer        | ticket, localize                       | `src/`, `fix.md` | T02  | tsc·check·test 통과, 회귀 테스트 또는 미작성 사유, 브라우저 확인 | orchestrator | 시작, 차단, 완료 (대리) |
| T04-postmortem | postmortem-agent | ticket, localize, fix, 이전 포스트모텀 | `postmortem.md`  | T03  | 유입 경로, 규칙 갱신안, Task Team 피드백                         | orchestrator | 시작, 차단, 완료        |

## Agent Team 실행 흐름

1. 실행 모드를 확인하고 버그 설명 원문을 `{run}/00-input.md`에 저장한다.
2. `TeamCreate`로 팀을 만들고 `TaskCreate`로 T01~T04를 의존 관계와 함께 등록한다.
3. T01. 중복이면 기존 run을 안내하고 팀을 정리한다. "빠진 정보"가 재현을 막으면 AskUserQuestion으로 사용자에게 묻고 티켓을 갱신한다.
4. T02. 원인을 특정할 수 없으면 후보 파일을 사용자에게 보여주고 확인받는다. 수정 방향 선택지가 여럿이면 AskUserQuestion으로 고르게 한다. 방향이 명확하면 승인 없이 T03으로 간다.
5. T03 - **worktree 격리**
   - `Agent(subagent_type: "bug-fixer", isolation: "worktree", name: "bug-{run id}")`로 스폰한다. 여러 버그를 동시에 처리하면 fixer마다 worktree를 따로 주고, `Agent` 호출은 메시지마다 하나씩 보낸다. 같은 파일을 고치는 버그끼리는 순차 실행한다.
   - 지시문: `{run}` 절대 경로, 수정 범위, "커밋 금지", `git-workflow.md` 병렬 작업 절 읽기.
   - 스폰 직후 `git worktree list`, `git branch --show-current`로 기대한 커밋에서 분기됐는지 확인한다. 어긋나면 `TaskStop`으로 중단하고 메인 체크아웃을 원래 브랜치로 돌린 뒤 다시 스폰한다.
   - 완료 후 orchestrator가 병합하고 직접 `git diff`, `pnpm exec tsc --noEmit`, `pnpm check`, `pnpm test`로 재검증한다. 실패하면 "무관해 보인다"로 넘기지 않고 원인을 확인해 fixer에게 다시 맡긴다(1회). 그래도 실패하면 사용자에게 보고한다.
   - Critical 버그면 수정 전에 사용자에게 심각도와 영향 범위를 먼저 알린다.
6. T04. 규칙 갱신안이 있으면 사용자에게 보여주고, 승인되면 `docs/agent-rules/`에 반영한 뒤 `docs/agent-harness/CHANGELOG.md`에 기록한다.
7. Phase 전환 전마다 `TaskGet`으로 완료·차단·지연을 확인한다. 멈춘 팀원은 `SendMessage`로 원인을 묻고, 재할당하면 `TaskUpdate`에 이유와 새 담당자를 남긴다.
8. `summary.md`: 원인, 수정, 검증, 제안 커밋 메시지와 PR 본문 초안.
9. **🔒 커밋·push·PR 승인 게이트** → 승인 시 `git-commit` Skill.
10. `improvement-log.md`에 이번 실행에서 하네스가 막혔던 점을 남기고 `TeamDelete`로 팀을 정리한다.
11. **PR 병합 후 정리**: task-team-orchestrator 14번과 같다(병합이 확인된 로컬 브랜치·worktree만 `git branch -d`, `git worktree remove`).

## 하이브리드 전환

- T02에서 T03 Subagent로 넘어갈 때 팀은 유지하고 `ticket.md`, `localize.md` 경로를 지시문으로 전달한다. 반환값만 믿지 않고 `fix.md`와 병합 후 재검증 결과로 판단한다.
- T03 완료 후 orchestrator가 `TaskUpdate`로 완료 처리하고 T04를 시작시킨다.
- 다른 팀 구성이 필요해지면 `{run}/handoff.md`를 남기고 `TeamDelete` 후 새 `TeamCreate`를 한다.

## 도구·검증 계약

- 도구는 실제 제공된 목록을 먼저 확인한다. 원본 절차의 도구가 없으면 현재 도구로 바꾸고, 실행하지 못한 프로토콜은 미검증으로 보고한다.
- Claude 팀원 스폰 지시문에 `필요 도구: Read, Edit, Bash`처럼 역할 정의의 tools와 대조한 선언을 넣는다. Write만 선언하면 `수정 파일: 없음` 또는 대상 경로를 적고, 기존 파일 수정에는 Edit가 필요하다.
- Codex는 실제 제공된 collaboration 도구로 팀원을 호출·조율하고, Task 상태는 `{run}/progress.md`에 남긴다. Claude 전용 도구 이름을 실행한 것으로 보고하지 않는다.
- 요구사항·API 계약·위험한 중간 산출물이 바뀌면 다음 단계 전에 QA에게 해당 경계면만 먼저 점검시킨다. 전체 QA와 별개로 결과를 `{run}`에 기록한다.
- 재작업은 기존 finding과 수정 diff를 검토하고, 사이클 전체 최종 리뷰에서는 CodeRabbit 교차검토를 다시 실행한다. 도구 인증·네트워크 실패는 자체 리뷰 결과와 구분해 기록한다.
- 같은 메인 체크아웃을 쓰는 다른 세션이 확인되면 스테이징·복원·병합 전 대상 파일과 작업을 조율한다. 타인의 변경을 되돌리지 않는다.

## 실패 처리

- 사용자 결정이 필요한 질문은 AskUserQuestion으로 묻는다. 재현 정보가 부족하면 추측하지 않는다.
- 팀원 1명이 멈추면 `TaskGet`으로 확인하고 `SendMessage`로 원인을 물어 1회 재시도한다. 재시도도 실패하면 재할당하거나 사용자에게 보고한다.
- T03 재검증이 실패하면 원인을 확인해 bug-fixer에게 1회 다시 맡기고, 그래도 실패하면 사용자에게 보고한다.
- 팀원 과반이 실패하면 진행하지 않고 현재 상태와 선택지를 보고한다.
- 규칙 문서 반영, 커밋·push·PR은 사람 승인 전에 하지 않는다.

## 산출물 계약

| 파일                   | 만드는 역할      | 다음에 읽는 역할                     | 완료 기준                         |
| ---------------------- | ---------------- | ------------------------------------ | --------------------------------- |
| `00-input.md`          | orchestrator     | bug-reporter                         | 버그 설명 원문                    |
| `ticket.md`            | bug-reporter     | bug-localizer, postmortem-agent      | 재현 단계, 빠진 정보              |
| `localize.md`          | bug-localizer    | bug-fixer, postmortem-agent          | 근본 원인, 모든 호출처            |
| `fix.md`               | bug-fixer        | orchestrator, postmortem-agent       | 검증 결과, 회귀 테스트 여부       |
| `postmortem.md`        | postmortem-agent | orchestrator, task-team-orchestrator | "Task Team 피드백"과 상태 표시    |
| `handoff.md` (필요 시) | orchestrator     | 새 팀, 다음 세션                     | 현재 단계와 다음 행동             |
| `summary.md`           | orchestrator     | 사용자                               | 커밋 메시지·PR 본문 초안          |
| `improvement-log.md`   | orchestrator     | 다음 하네스 개선                     | 막힌 점과 다음 수정 후보 1개 이상 |

모든 경로는 `artifacts/bug-team/{run id}/` 아래다.

## 테스트 프롬프트

| 유형        | 프롬프트                               | 기대 결과                                                   |
| ----------- | -------------------------------------- | ----------------------------------------------------------- |
| 정상        | "iOS에서 기록 작성할 때 화면이 확대돼" | ticket 작성, 기기·OS가 없으면 빠진 정보로 묻기              |
| 애매함      | "뭔가 이상해"                          | 화면·증상·환경을 묻고 티켓을 만들지 않음                    |
| 부분 재실행 | "GLB-140 포스트모텀만 다시 해줘"       | 기존 `{run}`을 읽고 T04만 실행                              |
| 실패 위험   | "원인은 대충 짐작되니까 바로 고쳐"     | T02 원인 분석을 생략하지 않고, 수정 방향을 근거와 함께 제시 |
| 부정        | "리스트뷰에 정렬 기능 추가해줘"        | 이 Skill을 쓰지 않고 task-team-orchestrator로 보냄          |
