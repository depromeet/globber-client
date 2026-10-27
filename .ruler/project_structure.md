# 자세한 예시/배경 설명은 src/docs/detailed-rules.md를 참고하세요.

```
src/
├── app/                    # Next.js App Router (페이지 및 API 라우트)
│   ├── api/               # API 라우트 (geocode, places 등)
│   ├── globe/             # 지구본 페이지
│   ├── record/            # 여행 기록 페이지
│   ├── profile/           # 프로필 페이지
│   └── ...
├── assets/                 # 정적 자산 (아이콘, 이미지)
│   └── icons/             # SVG 아이콘
├── components/             # 재사용 컴포넌트
│   ├── common/            # 공통 UI 컴포넌트 (Button, Input, Dialog 등)
│   ├── globe/             # 지구본 관련 컴포넌트
│   ├── imageMetadata/     # 이미지 메타데이터 컴포넌트
│   ├── nationSelect/      # 국가/도시 선택 컴포넌트
│   ├── record/            # 여행 기록 컴포넌트
│   ├── profile/           # 프로필 컴포넌트
│   └── ...
├── config/                 # 설정 파일
│   └── env.ts             # 환경변수 중앙 관리
├── constants/              # 상수 정의
│   ├── globe.ts           # 지구본 관련 상수
│   ├── zoomLevels.ts      # 줌 레벨 상수
│   └── ...
├── hooks/                  # 커스텀 훅
│   ├── useGlobeState.ts   # 지구본 상태 관리
│   ├── useClustering.ts   # 클러스터링 로직
│   └── ...
├── lib/                    # 라이브러리 설정
│   ├── apiClient.ts       # API 클라이언트
│   └── processFile.ts     # 파일 처리 (EXIF, HEIC)
├── services/               # API 서비스 레이어
│   ├── diaryService.ts    # 여행 기록 API
│   ├── profileService.ts  # 프로필 API
│   └── ...
├── styles/                 # 스타일 관련
│   └── globeStyles.ts     # 지구본 스타일 유틸리티
├── types/                  # TypeScript 타입 정의
│   ├── diary.ts           # 여행 기록 타입
│   ├── globe.ts           # 지구본 타입
│   └── ...
├── utils/                  # 유틸리티 함수
│   ├── cn.ts              # className 병합 (clsx + tailwind-merge)
│   ├── globeUtils.ts      # 지구본 유틸리티
│   └── ...
└── middleware.ts           # Next.js 미들웨어 (인증)
```

# 프로젝트 구조 핵심 규칙

0. 모노레포(pnpm workspaces + Turborepo): 웹은 `apps/web`, 공용 코드는 `packages/*`
   - `@globber/shared`: 플랫폼 무관 types/constants/schemas/utils (`@globber/shared/types/...` 형태로 import)
   - `@globber/tokens`: 디자인 토큰 (`pnpm tokens:build`)
   - `@globber/config`: tsconfig/eslint 공통 설정
   - `apps/mobile`: 웹을 WebView로 보여주는 앱 셸 (API 호출·화면은 모두 웹이 담당)
   - 공용 패키지에서는 `next/*`, `react-dom`, `@/` alias, DOM/쿠키 직접 접근 금지

1. `components/common/`: 2개 이상 페이지에서 재사용되는 UI 컴포넌트
2. `components/[feature]/`: 특정 기능에 종속된 컴포넌트
3. `services/`: 모든 API 호출, `lib/apiClient.ts` 사용
4. `hooks/`: 커스텀 훅, 복잡한 상태 로직 분리
5. `types/`: 도메인별 타입 분리 (4개 이상 속성 시 분리)
6. `constants/`: 매직 넘버 금지, 상수 파일로 분리
7. `config/env.ts`: 환경변수 중앙 관리
