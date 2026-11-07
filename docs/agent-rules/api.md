---
paths:
  - "apps/web/src/services/**"
  - "apps/web/src/lib/apiClient.ts"
  - "apps/web/src/app/api/**"
  - "apps/web/src/hooks/mutation/**"
  - "apps/web/src/types/**"
  - "apps/web/src/schemas/**"
---

# API · 데이터 흐름

## 계층

```
컴포넌트 ─(조회)→ 서버 컴포넌트에서 services/* 호출 (token 파라미터)
컴포넌트 ─(변경)→ hooks/mutation/use*Mutation → services/* → lib/apiClient
외부 키가 필요한 호출 → app/api/* (Route Handler, 서버 전용 키 사용)
```

## Service 레이어

| 항목        | 허용                                                            | 금지                                |
| ----------- | --------------------------------------------------------------- | ----------------------------------- |
| 호출        | `apiGet/apiPost/apiPut/apiPatch/apiDelete` (`lib/apiClient.ts`) | 백엔드 API에 `fetch(...)` 직접 호출 |
| 반환        | `return response.data;`                                         | `return response;`                  |
| 토큰        | 서버: 파라미터로 전달 / 클라이언트: `getAuthInfo()`             | 하드코딩                            |
| 에러 메시지 | 사용자 친화적 한국어                                            | 기술적 메시지 노출                  |

- `fetch` 직접 호출은 S3 presigned 업로드, 외부 공개 리소스(이미지 Blob 등), `app/api/*`의 외부 API 호출에만 허용한다.
- 환경변수는 `config/env.ts`만 통해 읽는다 (`env-ssr.md`).

## 에러 처리

- `ApiError`(`lib/apiClient.ts`)로 status·endpoint를 보존한다.
- 401/500은 apiClient가 `/error?type=401|500`로 전역 리다이렉트한다. 개별 컴포넌트에서 중복 처리하지 않는다.
- 로그는 `utils/logger.ts`를 쓴다. 운영에서 에러 상세를 노출하지 않는다. 예외 추적은 Sentry가 받는다.

## TanStack Query

- 변경(mutation)은 `hooks/mutation/use{Domain}Mutations.ts`에 `use{Action}{Domain}Mutation` 이름으로 둔다. `mutationFn`은 service 함수만 호출한다.
- 제네릭은 `useMutation<TData, Error, TVariables>`로 명시한다. 변수 타입은 `types/`의 `{Action}{Domain}Request`.
- 클라이언트 조회(`useQuery`)를 새로 도입할 때는 queryKey를 도메인별 상수(`[domain, ...params] as const`)로 정의하고, 같은 리소스를 바꾸는 mutation의 `onSuccess`에서 해당 key를 `invalidateQueries` 한다.
- 서버 컴포넌트에서 받은 데이터를 변경 후 갱신해야 하면 `router.refresh()`를 쓴다.

## 타입 네이밍

| 용도          | 패턴                                                     | 예시                                      |
| ------------- | -------------------------------------------------------- | ----------------------------------------- |
| 요청 파라미터 | `{Name}Params` / mutation 변수 `{Action}{Domain}Request` | `CreateDiaryParams`, `UpdateDiaryRequest` |
| API 응답      | `{Name}Response` (`status`/`data` 구조)                  | `DiaryDetailResponse`                     |
| 변환된 데이터 | `{Name}Detail`                                           | `DiaryDetail`, `CityDetail`               |

- 속성 4개 이상인 타입은 `types/{domain}.ts`로 분리한다.
- 사용자 입력 검증 스키마는 `schemas/`(zod)에 둔다.

플랫폼 공용 API 타입은 `packages/shared/src/types/`에 두고 `@globber/shared/types/{domain}`으로 가져온다. 브라우저·Next.js에 의존하는 서비스와 API 클라이언트는 `apps/web/src/`에 유지한다.
