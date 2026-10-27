# Globber

**3D 지구본 기반 여행 시각화 애플리케이션**

React 19와 Next.js 15를 기반으로 한 현대적인 웹 애플리케이션입니다. 사진의 EXIF 위치 정보를 추출하여 3D 지구본에 시각화합니다.

## Tech Stack

- **Framework**: Next.js 15.5.2, React 19.1.0
- **Language**: TypeScript (strict mode)
- **Package Manager**: pnpm 9.1.0
- **Styling**: TailwindCSS v4, CVA, clsx
- **State Management**: Zustand, TanStack React Query
- **3D Graphics**: Globe.gl, React-Globe.gl, Three.js
- **Image Processing**: EXIFR, HEIC2ANY
- **External APIs**: Google Maps Services
- **Code Quality**: Biome (linting/formatting)
- **Deployment**: Docker (standalone output)

## Getting Started

### Prerequisites

- Node.js 22.23.4 이상 (22.x)
- pnpm 9.x 이상

### Installation

```bash
# 의존성 설치
pnpm install

# AI 어시스턴트 설정 파일 생성 (최초 1회 실행 필요)
pnpm ruler:apply
```

### Environment Variables

`.env.local` 파일을 생성하고 다음 환경 변수를 설정하세요:

```bash
# Server-side only (API routes)
GOOGLE_MAPS_API_KEY=your_key_here

# Client-side (browser accessible)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
```

### Development

```bash
# 개발 서버 실행
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

### Production Build

```bash
# 프로덕션 빌드
pnpm build

# 프로덕션 서버 실행
pnpm start
```

## Available Scripts

### Development

- `pnpm dev` - 개발 서버 실행
- `pnpm build` - 프로덕션 빌드
- `pnpm start` - 프로덕션 서버 실행

### Code Quality

- `pnpm lint` - Biome 린트 실행 (자동 수정)
- `pnpm format` - Biome 포맷 실행 (자동 수정)
- `pnpm check` - Biome 전체 검사 (자동 수정)
- `pnpm reporter` - Biome 검사 요약 리포트
- `pnpm ci` - CI 모드로 Biome 검사

### Utilities

- `pnpm tokens:build` - 디자인 토큰 빌드
- `pnpm ruler:apply` - AI 어시스턴트 설정 파일 생성

## Project Structure

```
├── apps/
│   ├── mobile/                # Expo 앱 셸 - 웹을 WebView로 표시 (@globber/mobile)
│   │   └── src/
│   │       ├── App.tsx        # SafeArea + 스플래시 + WebView
│   │       └── webview/       # AppWebView(쿠키/뒤로가기/에러), 이동 정책
│   └── web/                   # Next.js 웹 앱 (@globber/web)
│       ├── src/
│       │   ├── app/           # Next.js App Router (api/ 라우트 포함)
│       │   ├── components/    # React components
│       │   ├── hooks/         # Custom React hooks
│       │   ├── lib/           # 유틸리티 함수
│       │   ├── constants/     # 상수 정의
│       │   └── types/         # TypeScript 타입 정의
│       ├── scripts/           # 유틸리티 스크립트 (디자인 토큰 빌드 등)
│       ├── public/            # 정적 파일
│       └── tokens.json        # 디자인 토큰
├── packages/                  # 앱 간 공유 패키지
│   ├── config/                # tsconfig, eslint 공통 설정
│   ├── shared/                # 공용 types, constants, schemas, utils
│   └── tokens/                # 디자인 토큰 (웹 CSS + 네이티브용 TS)
├── .ruler/                    # AI 어시스턴트 설정
├── turbo.json                 # Turborepo 태스크 설정
└── pnpm-workspace.yaml        # pnpm 워크스페이스 설정
```

> 이 저장소는 **pnpm workspaces + Turborepo** 모노레포입니다. 루트에서 `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`를 실행하면 turbo가 각 워크스페이스의 동일 이름 스크립트를 실행합니다. 특정 앱만 실행하려면 `pnpm dev:web` / `pnpm build:web`을 사용하세요.

### 모바일 앱 실행

앱은 웹(Next.js)을 **WebView로 보여주는 셸**입니다. 화면·API·로그인은 모두 웹이 처리합니다.

```bash
pnpm dev:mobile   # Expo 개발 서버 (Expo Go 또는 개발 빌드)
pnpm ios          # iOS 시뮬레이터
pnpm android      # Android 에뮬레이터
```

- 기본 접속 주소는 `https://globber.world` 입니다. 로컬 웹을 보려면 `EXPO_PUBLIC_WEB_URL=http://localhost:3000 pnpm dev:mobile` (Android 에뮬레이터는 `http://10.0.2.2:3000`)
- 서비스 도메인과 카카오 로그인 도메인만 WebView 안에서 이동하고, 그 외 링크/커스텀 스킴(`kakaotalk://`, `tel:` 등)은 시스템에 위임합니다 (`apps/mobile/src/webview/navigationPolicy.ts`)
- 웹에서는 User-Agent의 `GlobberApp/<버전>` 으로 앱 안 여부를 구분할 수 있습니다
- 번들링만 검증하려면 `pnpm --filter @globber/mobile bundle:check`
- 로그인 실기기 검증·스토어 심사 관련 확인 항목은 [docs/mobile/backend-questions.md](docs/mobile/backend-questions.md) 참고

## 모바일 앱 실행

```bash
pnpm dev:mobile   # Expo 개발 서버 (Expo Go 또는 개발 빌드)
pnpm ios          # iOS 시뮬레이터
pnpm android      # Android 에뮬레이터
```

- 환경변수: `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_S3_BASE_URL` (미설정 시 기본값 사용)
- 번들링만 검증하려면 `pnpm --filter @globber/mobile bundle:check`
- 앱 로그인은 백엔드의 `redirect_uri` 허용 설정이 필요합니다. 협의 항목은 [docs/mobile/backend-questions.md](docs/mobile/backend-questions.md) 참고

## AI Assistant Configuration

이 프로젝트는 [Ruler](https://github.com/intellectronica/ruler)를 사용하여 AI 어시스턴트(Claude Code, GitHub Copilot, Cursor 등)에 일관된 가이드를 제공합니다.

### 최초 설정

프로젝트 클론 후 **반드시 한 번** 실행하세요:

```bash
pnpm ruler:apply
```

이 명령어는 `.ruler/` 디렉토리의 가이드를 각 AI 도구별 설정 파일로 변환합니다:

- `.claude/CLAUDE.md` - Claude Code용
- `.github/.copilot-instructions.md` - GitHub Copilot용
- `.cursor/CURSOR.md` - Cursor용

### 가이드 문서 구조

- **AGENTS.md**: AI 어시스턴트 가이드 진입점
- **CONVENTIONS.md**: 네이밍, 코드 스타일, JSDoc 컨벤션
- **GLOBBER.md**: 프로젝트별 아키텍처 및 중요 규칙

## Code Conventions

주요 코딩 컨벤션:

- **변수명**: camelCase
- **상수명**: UPPER_SNAKE_CASE
- **컴포넌트**: PascalCase
- **타입**: `type` 사용 (interface 대신)
- **이벤트 핸들러**: `handle[Action][Target]` 또는 `on[Action][Target]`
- **Boolean 변수**: `is`, `has`, `should` 접두사

## HTTPS 개발 환경

HTTPS가 필요한 기능을 개발할 때는 로컬 HTTPS 서버를 사용할 수 있습니다.

### 초기 설정

1. mkcert 설치 (Mac):

```bash
brew install mkcert
```

2. 로컬 CA 등록:

```bash
mkcert -install
```

### 실행 방법

- 기본 (HTTP): `pnpm run dev`
- HTTPS 버전: `pnpm run dev:https`

## Learn More

자세한 내용은 [CONVENTIONS.md](.ruler/CONVENTIONS.md)를 참고하세요.

## Features

- 📸 **EXIF 기반 위치 추출** - 사진의 GPS 정보 자동 추출
- 🌍 **3D 지구본 시각화** - Three.js 기반 인터랙티브 지구본
- 📱 **모바일 최적화** - 512px 모바일 우선 디자인
- 🎨 **현대적인 UI** - TailwindCSS v4 기반 디자인 시스템
- 🖼️ **HEIC 지원** - iPhone HEIC 이미지 자동 변환
- 🗺️ **Google Maps 연동** - 장소 정보 및 지오코딩

## Documentation

- [Architectural Analysis Report](claudedocs/architectural-analysis-report.md)
- [AI Assistant Guide](.ruler/AGENTS.md)
- [Code Conventions](.ruler/CONVENTIONS.md)

## License

MIT
