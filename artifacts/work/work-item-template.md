# {work-id}

필요한 파일만 `artifacts/work/{work-id}/`에 만든다.

## STATUS.md

```md
# Status: {work-id}

- 마지막 갱신: {YYYY-MM-DD HH:mm}
- 이전 담당: Claude | Codex | 세션 이름
- 다음 담당: Claude | Codex | 사람 승인 대기
- 브랜치 / 체크아웃: feat/GLB-{번호} / 메인 | {worktree 경로}
- 현재 단계: 분석 | 구현 | 리뷰 | QA | 커밋 대기 | 완료
- 상태: 진행 가능 | 차단됨 | 사람 승인 대기 | 완료

## 완료된 일

## 차단 또는 주의 사항

## 다음 행동

1.
```

## HANDOFF.md

```md
# Handoff: {work-id}

## 먼저 읽을 순서

1. `artifacts/work/{work-id}/STATUS.md`
2.

## 핵심 결정

## 변경 파일 (미커밋 포함)

## 검증 결과

| 명령                     | 결과 | 실행 여부 | 비고 |
| ------------------------ | ---- | --------- | ---- |
| `pnpm exec tsc --noEmit` |      |           |      |
| `pnpm check`             |      |           |      |
| `pnpm test`              |      |           |      |

## 참조 산출물

- `artifacts/task-team/...` 또는 `artifacts/bug-team/...`: {핵심 결론}

## 미해결 항목과 사람 승인

## 다음 담당자가 할 일

1.
```
