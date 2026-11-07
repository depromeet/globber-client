# Globber

**3D 지구본 기반 여행 시각화 애플리케이션**

React 19와 Next.js 15를 기반으로 한 현대적인 웹 애플리케이션입니다. 사진의 EXIF 위치 정보를 추출하여 3D 지구본에 시각화합니다.

## Tech Stack

- **Framework**: Next.js 15.5, React 19.2
- **Language**: TypeScript (strict mode)
- **Package Manager**: pnpm 9.1.0
- **Styling**: TailwindCSS v4, CVA, clsx
- **State Management**: Zustand, TanStack React Query
- **3D Graphics**: Globe.gl, React-Globe.gl, Three.js
- **Image Processing**: EXIFR, HEIC2ANY
- **External APIs**: Google Maps Services
- **Code Quality**: ESLint + Prettier, Vitest, husky + lint-staged
- **Deployment**: Docker (standalone output)

## Getting Started

### Prerequisites

- Node.js 22.23.4 이상 (22.x)
- pnpm 9.x 이상

### Installation

```bash
# 의존성 설치
pnpm install
```

### Environment Variables

`.env.local` 파일을 생성하고 다음 환경 변수를 설정하세요:

```bash
# Server-side only (API routes)
GOOGLE_MAPS_API_KEY=your_key_here

# 웹훅 알림을 사용할 때만 설정
SENTRY_WEBHOOK_SECRET=
DISCORD_WEBHOOK_URL=
JIRA_WEBHOOK_SECRET=
JIRA_DISCORD_WEBHOOK_URL=

# Client-side (browser accessible, 빌드 시점에 번들에 포함됨)
NEXT_PUBLIC_API_BASE_URL=https://globber.world/api
NEXT_PUBLIC_REDIRECT_ORIGIN=http://localhost:3000
NEXT_PUBLIC_COOKIE_DOMAIN=localhost
NEXT_PUBLIC_S3_BASE_URL=https://globber-dev.s3.ap-northeast-2.amazonaws.com/
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
NEXT_PUBLIC_MAINTENANCE_MODE=false
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

코드에서는 `process.env` 대신 `src/config/env.ts`의 `env`(클라이언트 공용) / `serverEnv`(서버 전용)를 사용합니다.

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
- `pnpm dev:tunnel` - 개발 서버 + 터널 실행 (모바일 기기에서 확인)
- `pnpm build` - 프로덕션 빌드
- `pnpm start` - 프로덕션 서버 실행

### Code Quality

- `pnpm check` - ESLint + Prettier 검사
- `pnpm fix` - ESLint 자동 수정 + Prettier 포맷
- `pnpm lint` - ESLint 자동 수정
- `pnpm format` - Prettier 포맷
- `pnpm test` - Vitest 실행
- `pnpm typecheck` - 타입 검사 (pre-push 훅)

### Utilities

- `pnpm tokens:build` - 디자인 토큰 빌드

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
├── docs/agent-rules/          # Claude·Codex 공용 규칙
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

## AI Assistant (Claude Code · Codex)

Claude Code와 Codex가 같은 규칙과 하네스를 씁니다. 별도 생성 명령은 필요 없습니다.

- `CLAUDE.md` / `AGENTS.md` - 프로젝트 안내, 자연어 라우팅 (Claude / Codex 입구)
- `docs/agent-rules/` - 공용 규칙 원본 (코드·API·스타일·모바일·Git). Claude는 `.claude/rules/` 심볼릭 링크로 경로별 자동 로드
- `.claude/agents`, `.claude/skills` ↔ `.codex/agents`, `.agents/skills` - Task Team·Bug Team 하네스 (쌍으로 관리, pre-commit이 검사)
- `artifacts/` - 하네스 실행 산출물, `artifacts/work/` - Claude↔Codex 인계 파일 (`docs/agent-contracts/handoff.md`)

## Code Conventions

주요 코딩 컨벤션:

- **변수명**: camelCase
- **상수명**: UPPER_SNAKE_CASE
- **컴포넌트**: PascalCase
- **타입**: `type` 사용 (interface 대신)
- **함수/컴포넌트**: 화살표 함수 (Next.js 특수 파일 진입점 제외)
- **이벤트 핸들러**: `handle[Action][Target]`, 콜백 prop은 `on[Action]`
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

## 모바일 기기에서 확인하기

PC의 로컬 개발 서버를 휴대폰에서도 보려면 터널을 사용합니다. 카카오 로그인까지 동작합니다.

```bash
brew install cloudflared   # 최초 1회
pnpm dev:tunnel
```

출력되는 `https://*.trycloudflare.com` 주소로 폰에서 접속하세요. 자세한 내용은 [모바일 개발 가이드](docs/mobile-dev-tunnel.md)를 참고하세요.

## Learn More

자세한 규칙은 [docs/agent-rules](docs/agent-rules/README.md)를 참고하세요.

## Features

- 📸 **EXIF 기반 위치 추출** - 사진의 GPS 정보 자동 추출
- 🌍 **3D 지구본 시각화** - Three.js 기반 인터랙티브 지구본
- 📱 **모바일 최적화** - 512px 모바일 우선 디자인
- 🎨 **현대적인 UI** - TailwindCSS v4 기반 디자인 시스템
- 🖼️ **HEIC 지원** - iPhone HEIC 이미지 자동 변환
- 🗺️ **Google Maps 연동** - 장소 정보 및 지오코딩

## Documentation

- [모바일 기기에서 로컬 개발 서버 확인하기](docs/mobile-dev-tunnel.md)
- [에이전트 공용 규칙](docs/agent-rules/README.md)

## License

MIT
