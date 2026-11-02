# 하네스 적용 범위와 검증

## 기준과 범위

- 외부 하네스 동기화 연결·업스트림·lock·sync 스크립트·SessionStart 동기화 Hook·GitHub 동기화 워크플로를 추가하지 않는다.
- Claude/Codex 역할·스킬·Hook을 함께 관리한다. 모델·effort·기존 도구 권한·Playwright MCP 고정 버전을 유지한다.
- 역할은 기존 10개로 유지한다. 별도 백엔드 저장소를 구현하는 backend-developer는 추가하지 않는다.
- 실행별 `{run}` 산출물, 모바일 512px QA, GLB 커밋 형식과 기존 Git 보호 규칙을 유지한다.

## 반영 내용

- 공통 응답·가능 여부·재질문·검토 누락·커밋 경고 Hook과 Codex 편집 입력 어댑터.
- Git 프로세스 일괄 종료·동시 worktree 보호. PR #226의 전역 옵션·main push·삭제·강제 명령 보호도 유지.
- 실제 함수 호출 검증, 캐시 갱신·props·부분 목록·인증·경쟁 상태 검토, CodeRabbit 교차검토와 점진 QA.
- 하네스 설계 가이드와 Claude/Codex 구조·Hook 동작 회귀 검사.

## 제외·적응

- Biome 전용 자동 포맷·빈 줄 검사·에디터 확장과 설치 스크립트는 제외한다. ESLint·Prettier·Husky를 유지한다.
- 공통 브랜치명 `feature/*`를 복사하지 않는다. Globber의 GLB 브랜치명을 유지하고 PR 대상은 사용자 지정 브랜치를 확인한다.
- 동기화 전용 Harness-Scope 검사·중앙 변경 이력은 도입하지 않는다. 이 프로젝트 CHANGELOG에 수동 반영 이력을 남긴다.
- Hook은 보조 검사다. Claude·Codex CLI가 필요한 판정 Hook은 추가 호출 비용과 지연이 생길 수 있고 실패·타임아웃에는 통과한다. 역할 모델 설정은 바꾸지 않는다.
- Codex Hook 설정의 로딩·이벤트 지원은 실행 호스트에 의존한다. 정적 검사·고정 판정기로 실행한 테스트를 실제 세션 로딩·실서비스 검증으로 보고하지 않는다.

## 검증

`node --test .harness/*.test.mjs`, `pnpm exec tsc --noEmit`, `pnpm check`, `pnpm test`를 실행한다.
정상·모호한 요청·실패·재실행 입력은 Hook 회귀 테스트로 확인하고, LLM 판정기는 고정 응답으로 대체한다.

2026-11-02 결과: 타입·린트·포맷·셸 문법 검사 통과. Vitest 87개와 Node 하네스 검사 43개 통과, Codex 전용 정규식 검사를 Claude에 반복하는 항목 1개는 제외됐다. Claude 응답 판정은 별도 고정 판정기 테스트로 확인했다. 역할 10개의 모델·effort·도구 설정은 변경 전과 대조했다.

실제 Claude/Codex 세션에서의 Hook 로딩·LLM 판정 호출은 미검증이다. 실행 중 pnpm은 기존 `pnpm.overrides` 설정을 무시한다는 경고를 출력했으며, 해당 의존성 설정은 이번 범위에서 수정하지 않았다.
