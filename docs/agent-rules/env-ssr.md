---
paths:
  - "apps/web/src/**/*.{ts,tsx}"
  - "apps/mobile/src/**/*.{ts,tsx}"
  - "packages/*/src/**/*.{ts,tsx}"
  - "next.config.ts"
  - "Dockerfile"
  - ".github/workflows/**"
---

# 환경변수 · SSR

## 환경변수

- 코드에서 `process.env`를 직접 읽지 않는다. **`apps/web/src/config/env.ts`만** 쓴다.
  - `env`: 브라우저에서도 쓰는 값(`NEXT_PUBLIC_*`, `NODE_ENV` 파생 플래그)
  - `serverEnv`: 서버 전용 비밀 값(`GOOGLE_MAPS_API_KEY` 등). Route Handler·서버 컴포넌트에서만 import 한다.
- 예외: `instrumentation.ts`의 `process.env.NEXT_RUNTIME`(Next.js가 주입하는 런타임 구분 값).
- `NEXT_PUBLIC_*`는 **빌드 시점에 번들에 박힌다.** 새 값을 추가하면 `Dockerfile`의 `ARG`/`ENV`와 `.github/workflows/deploy.yml`의 `build-args`에도 추가한다. (GLB-104: GA ID 누락으로 운영에서 미수집)
- 비밀 키는 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
- 새 변수는 `env.ts`에 기본값 또는 `undefined` 허용 여부를 명시하고, README의 환경변수 목록도 갱신한다.

```typescript
import { env } from "@/config/env";

if (env.IS_LOCAL_DEV) console.error(error);
const url = `${env.S3_BASE_URL}${key}`;
```

## SSR 호환성

- globe.gl/react-globe.gl/three 등 `window`가 필요한 라이브러리: `dynamic(() => import(...), { ssr: false })`.
- `window`/`document` 접근 전 가드: `if (typeof window === "undefined") return;`
- 렌더 결과가 서버·클라이언트에서 달라지는 값(`Date.now()`, `Math.random()`, `localStorage`)은 `useEffect` 이후에 반영해 hydration mismatch를 피한다.
- heic2any는 브라우저 전용이므로 동적 import.

## 자주 생기는 문제

| 증상                      | 확인                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| 지구본이 안 그려짐        | `ssr: false` dynamic import, window 가드, 컨테이너 크기                                               |
| HEIC 처리 실패            | heic2any 동적 import, `file.type`/확장자 검사 (`mobile-web.md`)                                       |
| Google Maps 오류          | 클라이언트는 `env.GOOGLE_MAPS_API_KEY`, 서버 Route는 `serverEnv.GOOGLE_MAPS_API_KEY`, API 활성화 여부 |
| 운영에서만 값이 비어 있음 | `NEXT_PUBLIC_*` 빌드 인자 누락                                                                        |

공유 패키지는 웹의 `config/env.ts`를 가져오지 않는다. `packages/shared/src/utils/logger.ts`의 실행 모드 판별은 플랫폼 공통 `process.env.NODE_ENV`를 직접 읽는다. 웹 전용 설정은 `apps/web/src/config/env.ts`를 따른다.
