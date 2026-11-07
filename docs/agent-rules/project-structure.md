# 프로젝트 구조

```
apps/web/src/
├── app/                  # App Router 라우트 (폴더명 kebab-case = URL)
│   ├── api/              # Route Handler (geocode, places) - 서버 전용 키 사용
│   ├── globe/ record/ profile/ saved-globe/ nation-select/ image-metadata/
│   ├── login/ terms/ withdrawal/ error/
│   ├── layout.tsx error.tsx global-error.tsx not-found.tsx robots.ts sitemap.ts
│   └── globals.css       # Tailwind v4 @theme 토큰
├── assets/icons/         # SVG(@svgr) · 이미지
├── components/
│   ├── common/           # 2개 이상 화면에서 재사용하는 UI (Button, Dialog, BottomSheet ...)
│   └── {feature}/        # 기능 전용, 폴더명 camelCase (globe, record, imageMetadata, listView, nationSelect, profile, savedGlobe ...)
│       └── hooks/        # 그 기능에서만 쓰는 훅
├── config/env.ts         # 환경변수 단일 진입점
├── constants/            # 상수 (매직 넘버 금지)
├── hooks/                # 공용 훅, mutation/ = TanStack Query 변경 훅
├── lib/                  # apiClient, processFile(EXIF/HEIC), globe/(렌더링·클러스터링 로직)
├── schemas/              # zod 입력 검증
├── services/             # 백엔드 API 호출 (도메인별 *Service.ts)
├── stores/               # Zustand 스토어 (전역 클라이언트 상태가 필요할 때)
├── types/                # 도메인별 타입
├── utils/                # 순수 유틸 (cn, dateUtils, logger ...)
├── middleware.ts         # 인증 리다이렉트
└── instrumentation*.ts   # Sentry
```

## 워크스페이스

- `apps/web`: Next.js 웹. `@/`는 `apps/web/src/`를 가리킨다.
- `apps/mobile`: Expo WebView 앱 셸. API 호출과 서비스 화면은 웹이 담당한다.
- `packages/shared`: 플랫폼 공용 타입·상수·스키마·순수 유틸. `@globber/shared/types/...` 등 패키지 export로 가져온다. Next.js·react-dom·웹 `@/` alias·DOM·쿠키에 의존하지 않는다.
- `packages/tokens`: 공용 디자인 토큰. `pnpm tokens:build`로 웹 CSS와 앱 토큰을 생성한다.
- `packages/config`: 공용 TypeScript·ESLint 설정.
- 루트 `scripts/`·`.harness/`: 하네스 검사. `pnpm test`는 workspace 테스트와 Vitest·Node 하네스 검사를 모두 실행한다.

## 배치 규칙

1. 새 컴포넌트는 먼저 `components/common/`에 같은 역할이 있는지 확인하고 재사용한다.
2. 한 기능에서만 쓰면 `components/{feature}/`, 두 곳 이상에서 쓰이면 `common/`으로 올린다.
3. 백엔드 호출은 전부 `services/` → `lib/apiClient.ts` (`api.md`).
4. 전역 클라이언트 상태는 Zustand(`stores/`), 서버 상태는 TanStack Query. 컴포넌트 트리 안에서 끝나는 상태는 `useState`.
5. 속성 4개 이상인 타입은 `types/{domain}.ts`로 분리한다.
6. 매직 넘버는 `constants/`로. 지구본 줌/클러스터링 값은 `constants/globeConfig.ts`, `constants/clusteringConstants.ts`.

## 기술 스택

| 항목          | 값                                                                 |
| ------------- | ------------------------------------------------------------------ |
| Framework     | Next.js 15.5, React 19.2, TypeScript strict                        |
| 패키지 매니저 | pnpm 9                                                             |
| 품질          | ESLint 9 + Prettier, husky(pre-commit: lint-staged, pre-push: tsc) |
| 스타일        | TailwindCSS v4, CVA, clsx + tailwind-merge                         |
| 상태          | TanStack Query, Zustand                                            |
| 폼            | react-hook-form + zod                                              |
| 3D            | globe.gl, react-globe.gl, three                                    |
| 이미지        | exifr, heic2any, react-easy-crop                                   |
| UI 프리미티브 | Radix UI                                                           |
| 모니터링      | Sentry, GA(`@next/third-parties`)                                  |
| 배포          | Docker standalone, `main` push 시 GHCR 빌드 → 운영 배포            |
