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
- `pnpm exec tsc --noEmit` - 타입 검사 (pre-push 훅)

### Utilities

- `pnpm tokens:build` - 디자인 토큰 빌드

## Project Structure

```
├── src/
│   ├── app/          # Next.js App Router (페이지, Route Handler)
│   ├── components/   # common/ + 기능별 컴포넌트
│   ├── config/       # env.ts (환경변수 단일 진입점)
│   ├── constants/    # 상수
│   ├── hooks/        # 커스텀 훅, mutation/ (TanStack Query)
│   ├── lib/          # apiClient, 이미지 처리, globe 로직
│   ├── schemas/      # zod 스키마
│   ├── services/     # 백엔드 API 호출
│   ├── types/        # 타입 정의
│   └── utils/        # 순수 유틸
├── .claude/          # Claude Code 하네스 (agents, skills, hooks)
├── .codex/ .agents/  # Codex 하네스 (agents, hooks / skills)
├── docs/             # 공용 에이전트 규칙·인계 절차
├── artifacts/        # 하네스 실행 산출물
├── scripts/          # 유틸리티 스크립트
└── public/           # 정적 파일
```

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
