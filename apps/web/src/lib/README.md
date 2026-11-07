# API Client 사용법

## 개요

통일된 API 클라이언트를 사용하여 HTTP 요청을 관리합니다. 모든 API 요청은 일관된 에러 핸들링과 헤더 관리를 제공합니다.

## 기본 사용법

### 1. GET 요청 (인증 없음)

```typescript
import { apiGet } from "@/lib/apiClient";

// 기본 GET 요청
const cities = await apiGet("/cities/favorites", { limit: 20 });

// 파라미터 없이
const data = await apiGet("/some-endpoint");
```

### 2. GET 요청 (인증 필요)

```typescript
import { apiGet } from "@/lib/apiClient";

const userProfile = await apiGet("/auth/profile", undefined, "your-jwt-token");
```

### 3. POST 요청

```typescript
import { apiPost } from "@/lib/apiClient";

// 인증 없이
const result = await apiPost("/auth/login", { email, password });

// 인증 필요
const newGlobe = await apiPost("/globe/create", { cities }, token);
```

### 4. PUT 요청

```typescript
import { apiPut } from "@/lib/apiClient";

const updatedGlobe = await apiPut("/globe/123", { name: "새 이름" }, token);
```

### 5. DELETE 요청

```typescript
import { apiDelete } from "@/lib/apiClient";

await apiDelete("/globe/123", token);
```

## 서비스 사용법

### 도시 서비스

```typescript
import { fetchCities } from "@/services/cityService";

// 클라이언트에서 사용
const cities = await fetchCities({ limit: 53, offset: 0 });

// SSR에서 사용
const initialCities = await fetchCities({ limit: 53 });
```

### 인증 서비스

```typescript
import { authService } from "@/services/authService";

// 로그인
const loginResult = await authService.login({ email, password });

// 사용자 정보 조회
const profile = await authService.getProfile(token);
```

### 지구본 서비스

```typescript
import { globeService } from "@/services/globeService";

// 지구본 생성
const newGlobe = await globeService.createGlobe(selectedCities, token);

// 지구본 목록 조회
const globes = await globeService.getUserGlobes(token);
```

## 에러 핸들링

```typescript
import { ApiError } from "@/lib/apiClient";

try {
  const data = await apiGet("/some-endpoint");
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API Error: ${error.message}`);
    console.error(`Status: ${error.status}`);
    console.error(`Endpoint: ${error.endpoint}`);
  } else {
    console.error("Unexpected error:", error);
  }
}
```

## 환경변수 설정

`.env.local` 파일에 다음을 추가하세요:

```env
NEXT_PUBLIC_API_BASE_URL=https://globber.store/api/v1
```

## 특징

- **타입 안전성**: TypeScript 제네릭을 사용한 타입 안전한 API 호출
- **일관된 에러 핸들링**: 모든 API 요청에 대해 동일한 에러 처리
- **인증 지원**: 토큰 기반 인증을 쉽게 추가할 수 있음
- **재사용성**: 모든 HTTP 메소드를 통일된 방식으로 사용
- **로깅**: 자동 에러 로깅으로 디버깅 용이
