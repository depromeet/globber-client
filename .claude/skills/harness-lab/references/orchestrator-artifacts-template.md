# Orchestrator와 산출물 템플릿

이 문서는 실제 `.claude` 파일이나 하네스 청사진을 작성할 때 사용한다. Orchestrator는 일을 직접 다 하는 존재가 아니라, 역할을 나누고 산출물을 이어받고 실패와 승인 지점을 관리하는 입구다.

## 목차

- [목차](#목차)
- [언제 읽을까](#언제-읽을까)
- [하네스 청사진](#하네스-청사진)
- [산출물 구조 선택](#산출물-구조-선택)
- [산출물 계약 표](#산출물-계약-표)
- [.claude/agents/{agent-name}.md](#claudeagentsagent-namemd)
- [.claude/skills/{skill-name}/SKILL.md](#claudeskillsskill-nameskillmd)
- [결과](#결과)
- [근거](#근거)
- [확인 필요](#확인-필요)
- [.claude/skills/{harness-name}-orchestrator/SKILL.md](#claudeskillsharness-name-orchestratorskillmd)
- [CLAUDE.md 포인터](#claudemd-포인터)

## 목차

1. 언제 읽을까
2. 하네스 청사진
3. 산출물 구조 선택
4. 산출물 계약 표
5. Agent 템플릿
6. Skill 템플릿
7. Orchestrator 템플릿
8. `CLAUDE.md` 포인터

## 언제 읽을까

- 청사진 템플릿이 필요할 때
- `.claude/agents`, `.claude/skills`, `CLAUDE.md` 초안을 만들어야 할 때
- `artifacts/` 산출물 계약과 파일 구조를 정해야 할 때
- Agent Team Orchestrator의 Task, 메시지, 팀 정리 조건을 작성해야 할 때

## 하네스 청사진

```md
## 하네스 청사진

### 목표

- 이 하네스가 돕는 일:
- 최종 산출물:
- 주요 사용자:
- 현재 성숙도:

### 하네스 7요소

| 요소        | 이번 하네스에서의 내용 |
| ----------- | ---------------------- |
| 목표        |                        |
| 컨텍스트    |                        |
| 도구        |                        |
| 중간 산출물 |                        |
| 검증        |                        |
| 권한과 승인 |                        |
| 기록과 개선 |                        |

### 사람의 작업 절차

1.
2.
3.

### 실행 모드와 팀 패턴

- 실행 모드: 단일 흐름 | Subagent | Agent Team | Hybrid
- 패턴:
- 선택 이유:
- 단일 흐름으로 충분하지 않은 이유:
- Agent Team을 선택했다면 필요한 팀 조율:

### Agent 역할표

| Agent | 맡는 일 | 분리 이유 | 입력 | 출력 | 하지 말아야 할 일 |
| ----- | ------- | --------- | ---- | ---- | ----------------- |
|       |         |           |      |      |                   |

### Skill 목록

| Skill | 사용하는 Agent | 절차 요약 | 품질 기준 |
| ----- | -------------- | --------- | --------- |
|       |                |           |           |

### Orchestrator 흐름

- Orchestrator Skill 이름: `{하네스-이름}-orchestrator`
- Orchestrator Skill 위치: `.claude/skills/{하네스-이름}-orchestrator/SKILL.md`
- 실행 모드:
- 중간 산출물 위치: `artifacts/`
- 사람 승인 지점:

1.
2.
3.

### 산출물 계약

| 단계      | 파일                           | 만드는 역할  | 다음에 읽는 역할   | 재사용 방식           |
| --------- | ------------------------------ | ------------ | ------------------ | --------------------- |
| 입력 정리 | `artifacts/00-input.md`        | Orchestrator | 모든 역할          | 요청 범위와 제약 확인 |
| 조사/분석 | `artifacts/01-brief.md`        |              |                    |                       |
| 초안/구현 | `artifacts/02-draft.md`        |              |                    |                       |
| 검토      | `artifacts/03-review.md`       |              |                    |                       |
| 최종      | `artifacts/final.md`           | Orchestrator | 사용자와 다음 실행 | 실제 사용 결과        |
| 개선 기록 | `artifacts/improvement-log.md` | Orchestrator | 다음 개선 작업     | 실패와 변경 근거      |

### Agent Team 실행 계약

Agent Team을 선택한 경우에만 작성한다.

| 항목                        | 이번 하네스의 계약                     |
| --------------------------- | -------------------------------------- |
| `TeamCreate` 팀원           |                                        |
| `TaskCreate` 작업 목록      |                                        |
| `TaskUpdate` 상태 갱신      | 시작, 차단, 완료, 재할당               |
| `TaskGet` 확인 시점         | Phase 전환 전, 지연 감지, 최종 통합 전 |
| `SendMessage`가 필요한 상황 | 발견 공유, 질문, 충돌, 차단, 완료      |
| 파일 산출물 규칙            |                                        |
| 팀 재구성 조건              |                                        |
| `TeamDelete` 시점           |                                        |

### 테스트 프롬프트

| 유형        | 프롬프트 | 기대 결과 |
| ----------- | -------- | --------- |
| 정상        |          |           |
| 애매함      |          |           |
| 실패 위험   |          |           |
| 부정 테스트 |          |           |
```

청사진 단계에서는 위 내용을 사용자에게 보여주고 멈춘다. 이 단계에서는 `.claude/agents`, `.claude/skills`, `CLAUDE.md`, `artifacts/` 파일을 만들지 않는다. 사용자가 이 청사진에 대해 명시적으로 구성 요청을 한 뒤에만 실행 하네스 파일을 만든다.

## 산출물 구조 선택

기본 위치는 현재 프로젝트의 `artifacts/`이다. 작은 하네스는 평면 구조로 시작하고, 역할이 많거나 실행이 길어지면 폴더형 구조로 확장한다.

| 구조        | 쓰기 좋은 경우                                     | 특징                                                     |
| ----------- | -------------------------------------------------- | -------------------------------------------------------- |
| 평면 구조   | 첫 실습, 짧은 문서 작업, Agent 2-3개 수준          | 파일 수가 적고 사용자가 바로 이해하기 쉽다               |
| 폴더형 구조 | 실무용 문서, 코드 작업, Agent Team 재구성, 긴 실행 | 단계별 산출물을 나누고 archive와 handoff를 관리하기 좋다 |

평면 구조:

```text
artifacts/
├── README.md
├── 00-input.md
├── 01-working.md
├── 02-review.md
├── final.md
└── improvement-log.md
```

폴더형 구조:

```text
artifacts/
├── README.md
├── 00-input.md
├── 10-analysis/
├── 20-agent-outputs/
├── 30-review/
├── final/
├── handoff.md
├── improvement-log.md
└── archive/
```

## 산출물 계약 표

| 단계      | 파일                                   | 만드는 역할        | 다음에 읽는 역할  | 재사용 방식                | 완료 기준               |
| --------- | -------------------------------------- | ------------------ | ----------------- | -------------------------- | ----------------------- |
| 입력 정리 | `artifacts/00-input.md`                | Orchestrator       | 모든 역할         | 목표, 제약, 승인 지점 확인 | 누락 질문 분리          |
| 조사/분석 | `artifacts/10-analysis/{topic}.md`     | Researcher/Analyst | Writer/Builder    | 초안과 판단 근거           | 출처와 불확실성 구분    |
| 생성/구현 | `artifacts/20-agent-outputs/{role}.md` | Writer/Builder     | Reviewer          | 검토 대상                  | 요구 형식 충족          |
| 검토      | `artifacts/30-review/{role}.md`        | Reviewer/QA        | Orchestrator      | 수정과 승인 판단           | 증거 기반 지적          |
| 최종      | `artifacts/final/{name}.md`            | Orchestrator       | 사용자, 다음 실행 | 실제 사용 결과             | 승인 조건 표시          |
| 개선      | `artifacts/improvement-log.md`         | Orchestrator       | 다음 개선 작업    | 실패와 변경 근거           | 다음 수정 후보 1개 이상 |

## `.claude/agents/{agent-name}.md`

```md
---
name: example-agent
description: 이 Agent가 언제 호출되어야 하는지 한 문장으로 설명한다.
tools: Read, Grep, Glob
skills:
  - optional-skill-name
---

당신은 {역할 이름}입니다.

## 책임

-

## 입력

-

## 출력

- 결과 요약:
- 파일 경로:

## 작업 방식

1. 먼저 요청의 목적과 산출물을 확인합니다.
2. 필요한 자료를 읽고, 근거가 없는 내용은 추측하지 않습니다.
3. 결과를 정해진 형식으로 남깁니다.

## 팀 통신 프로토콜

- 메시지 수신:
- 메시지 발신:
- 작업 요청:
- 파일 산출물:
- 차단 조건:

## 하지 말아야 할 일

- 역할 밖의 결정을 대신 확정하지 않습니다.
- 확인하지 않은 사실을 단정하지 않습니다.
- 외부 발송, 제출, 삭제, 결제처럼 책임이 생기는 행동을 사람 승인 없이 완료하지 않습니다.
```

## `.claude/skills/{skill-name}/SKILL.md`

````md
---
name: example-skill
description: 이 Skill이 필요한 상황과 트리거를 구체적으로 적는다.
---

# Example Skill

## Overview

이 Skill은 {역할}이 {작업}을 일관되게 수행하도록 돕는다.
부족한 정보가 있으면 먼저 질문하고, 사용자가 주지 않은 사실을 임의로 만들지 않는다.

## Workflow

1. 입력 자료를 확인한다.
2. 빠진 조건을 표시한다.
3. 결과를 작성한다.
4. 품질 기준으로 점검한다.

## 산출물 형식

```md
## 결과

-

## 근거

-

## 확인 필요

-
```

## 품질 기준

- 결과가 사용자의 원래 목표와 연결되어야 한다.
- 근거와 추측을 구분해야 한다.
- 다음 단계에서 바로 사용할 수 있어야 한다.

## 예외와 금지 행동

- 정보가 부족하면 추측하지 말고 질문한다.
- 이 Skill의 범위를 벗어난 요청은 Orchestrator나 사용자에게 되돌린다.
````

## `.claude/skills/{harness-name}-orchestrator/SKILL.md`

```md
---
name: example-orchestrator
description: 여러 Agent와 Skill을 순서대로 묶어 하나의 하네스 실행 흐름을 만들 때 사용한다. 초기 실행뿐 아니라 재실행, 다시 실행, 업데이트, 수정, 보완, 이전 결과 기반 개선, 특정 단계만 다시 처리하는 요청에도 사용한다.
---

# Example Orchestrator

## 목적

이 Orchestrator는 {업무 이름}을 여러 역할로 나누고, 중간 산출물을 이어서 최종 결과를 만든다.

## 실행 모드

기본 후보 실행 모드는 Agent Team이다. 다만 작업이 작고 조율이 필요 없으면 단일 흐름이나 Subagent 흐름으로 줄인다.

## 실행 모드 확인

1. `artifacts/` 또는 기존 중간 산출물이 있는지 확인한다.
2. 기존 산출물이 없으면 초기 실행으로 진행한다.
3. 기존 산출물이 있고 사용자가 일부 수정만 요청하면 해당 단계만 부분 재실행한다.
4. 새 입력으로 다시 시작해야 하면 기존 산출물을 `artifacts/archive/{YYYYMMDD-HHMMSS}/`에 보존하고 새 실행을 시작한다.
5. 기존 산출물이 있지만 사용자의 의도가 불분명하면 "이어 하기", "부분 수정", "새 실행" 중 무엇인지 먼저 확인한다.

## 실행 모드별 데이터 전달

| 실행 모드  | 진행 상태                             | 중간 공유           | 기억해야 할 산출물     |
| ---------- | ------------------------------------- | ------------------- | ---------------------- |
| Agent Team | `TaskCreate`, `TaskUpdate`, `TaskGet` | `SendMessage`       | `artifacts/`           |
| Subagent   | Orchestrator가 직접 추적              | 반환값              | `artifacts/`           |
| Hybrid     | Phase별로 다르게 명시                 | 전환 시 파일로 인계 | `artifacts/handoff.md` |

## Agent Team 구성

| 팀원             | Agent 파일                     | 역할 | 주요 산출물                 |
| ---------------- | ------------------------------ | ---- | --------------------------- |
| {Agent A}        | `.claude/agents/{agent-a}.md`  |      | `artifacts/01-{agent-a}.md` |
| {Agent B}        | `.claude/agents/{agent-b}.md`  |      | `artifacts/02-{agent-b}.md` |
| {Reviewer Agent} | `.claude/agents/{reviewer}.md` |      | `artifacts/03-review.md`    |

## Task 등록 계약

| Task         | 담당             | 입력          | 출력                     | 의존 | 완료 기준                  | 상태 갱신        |
| ------------ | ---------------- | ------------- | ------------------------ | ---- | -------------------------- | ---------------- |
| T01-input    | Orchestrator     | 사용자 요청   | `artifacts/00-input.md`  | 없음 | 목표, 제약, 승인 지점 정리 | 작성 완료        |
| T02-analysis | {Agent A}        | `00-input.md` | `artifacts/01-brief.md`  | T01  | 근거와 불확실성 구분       | 시작, 차단, 완료 |
| T03-produce  | {Agent B}        | `01-brief.md` | `artifacts/02-draft.md`  | T02  | 요구 형식 충족             | 시작, 차단, 완료 |
| T04-review   | {Reviewer Agent} | `02-draft.md` | `artifacts/03-review.md` | T03  | 수정 필요와 승인 필요 구분 | 시작, 차단, 완료 |

## Agent Team 실행 흐름

1. 요청을 정리하고 `artifacts/00-input.md`에 입력, 제약, 승인 지점을 저장한다.
2. `TeamCreate`로 필요한 Agent를 팀원으로 구성한다.
3. `TaskCreate`로 단계별 작업과 의존 관계를 등록한다.
4. 팀원들은 `TaskUpdate`로 시작, 차단, 완료 상태를 갱신한다.
5. Orchestrator는 Phase 전환 전 `TaskGet`으로 누락과 지연을 확인한다.
6. 팀원들은 `SendMessage`로 발견, 질문, 충돌 지점, 완료 알림을 공유한다.
7. 각 팀원은 자기 산출물을 `artifacts/`에 저장한다.
8. Orchestrator는 산출물을 읽고 누락, 충돌, 승인 필요 사항을 확인한다.
9. 최종 결과를 `artifacts/final.md`에 저장한다.
10. `artifacts/improvement-log.md`와 필요한 경우 `artifacts/handoff.md`를 갱신한다.
11. 실행이 끝나면 `TeamDelete`로 팀을 정리한다.

## 하이브리드 전환

- 팀에서 Subagent로 넘어갈 때는 먼저 팀 산출물을 저장하고 `TeamDelete`를 수행한다.
- Subagent 결과를 팀이 이어받아야 하면 반환값만 넘기지 말고 `artifacts/` 파일로 저장한다.
- 새 팀이 필요하면 `artifacts/handoff.md`를 만든 뒤 기존 팀을 정리하고 새 `TeamCreate`를 수행한다.

## 실패 처리

- 입력이 부족하면 바로 생성하지 말고 빠진 정보를 질문한다.
- 중간 산출물이 다음 단계에서 쓰기 어렵다면 해당 단계만 다시 수행한다.
- 팀원 1명이 실패하면 `TaskGet`으로 상태를 확인하고 `SendMessage`로 1회 재시도 또는 재할당을 지시한다.
- 과반 작업이 실패하면 현재 상태, 남은 위험, 가능한 선택지를 사용자에게 보고하고 확인을 받는다.
- 충돌하는 결과는 삭제하지 말고 출처와 근거를 병기한다.
- 품질 기준을 통과하지 못하면 수정 목록을 먼저 제시한다.
- 외부 발송, 제출, 삭제, 결제, 법적 표현, 개인정보 처리는 사람 승인 전 완료하지 않는다.
```

## `CLAUDE.md` 포인터

```md
# Project Harness

이 프로젝트에는 하네스가 있습니다.

## 주요 위치

- 실행 스킬: `.claude/skills/`
- Agent: `.claude/agents/`
- 중간 산출물: `artifacts/`

## 자연어 라우팅

사용자가 스킬명을 직접 입력하지 않아도 이 하네스의 업무로 판단되면 `{harness-name}-orchestrator`를 먼저 사용한다.

예:

- "{업무} 계획을 만들어줘"
- "{업무} 초안을 정리해줘"
- "{업무}를 역할별로 나눠서 진행해줘"
- "{업무} 결과를 검토하고 개선해줘"
- "{업무}를 이전 결과 기반으로 다시 보완해줘"
- "{업무}의 검토 단계만 다시 실행해줘"

## 하네스 변경 이력

| 날짜       | 변경 내용 | 대상 | 사유                  |
| ---------- | --------- | ---- | --------------------- |
| YYYY-MM-DD | 초기 구성 | 전체 | 반복 업무 하네스 생성 |
```
