# API Client 사용법

## 개요

백엔드 요청은 `@/lib/apiClient`의 함수로 보냅니다. 요청 주소, 인증 헤더, 제한 시간, 오류 처리를 한곳에서 맞춥니다.

- 요청 주소는 `NEXT_PUBLIC_API_BASE_URL` + `endpoint`입니다. 기본값은 `https://globber.world/api`이고, 개발 서버는 `https://dev.globber.world/api`입니다.
- 백엔드 경로는 대부분 `/api/v1/...`로 시작합니다(예: `/api/v1/cities/favorites`). 회원 API(`/auth/token`, `/logout`, `/withdraw`)는 `/api` 접두사가 없습니다.
- 모든 요청은 기본 10초(`DEFAULT_REQUEST_TIMEOUT_MS`) 뒤에 끊기고 `ApiError(408)`가 됩니다.
- 실패하면 `ApiError`(`status`, `endpoint`)를 던집니다. 클라이언트에서 401·5xx가 나면 오류 화면으로 이동합니다(`apiGet`은 `skipGlobalErrorHandling`으로 끌 수 있음).

## 함수

| 함수                 | 시그니처                                                                         |
| -------------------- | -------------------------------------------------------------------------------- |
| `apiGet`             | `apiGet<T>(endpoint, params?, token?, options?)`                                 |
| `apiPost`            | `apiPost<T>(endpoint, data?, token?, options?)`                                  |
| `apiPostWithHeaders` | `apiPostWithHeaders<T>(endpoint, data?, token?, options?)` → `{ data, headers }` |
| `apiPut`             | `apiPut<T>(endpoint, data?, token?, options?)`                                   |
| `apiPatch`           | `apiPatch<T>(endpoint, data?, token?, options?)`                                 |
| `apiDelete`          | `apiDelete<T>(endpoint, data?, token?, options?)`                                |

- `token`을 넘기면 `Authorization: Bearer {token}` 헤더를 붙입니다.
- `options.timeoutMs`로 요청별 제한 시간을 바꿀 수 있습니다.

## 예시

```typescript
import { ApiError, apiDelete, apiGet, apiPost } from "@/lib/apiClient";

// 인기 도시 (인증 없음)
const cities = await apiGet<CityApiResponse>("/api/v1/cities/favorites", { limit: 53 });

// 내 여행지 (인증 필요)
const travels = await apiGet<MemberTravelsResponse>("/api/v1/member-travels", {}, token);

// 여행지 추가
await apiPost<CreateTravelRecordsResponse>("/api/v1/member-travels", travelRecords, token);

// 여행지 삭제 (204, 본문 없음)
await apiDelete<void>(`/api/v1/member-travels/${cityId}`, undefined, token);

// 오류 처리
try {
  await apiGet("/api/v1/profiles/me", {}, token);
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.status, error.endpoint);
  }
}
```

화면에서는 보통 이 함수를 직접 부르지 않고 `@/services/*`(예: `cityService.fetchCities`, `memberService.getMemberTravels`)를 씁니다.

## 환경 변수

`apps/web/.env.local`에 넣습니다.

```env
# 개발 서버 백엔드를 쓸 때
NEXT_PUBLIC_API_BASE_URL=https://dev.globber.world/api
```
