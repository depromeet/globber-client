---
paths:
  - "apps/web/src/**/*.{ts,tsx}"
  - "apps/mobile/src/**/*.{ts,tsx}"
  - "packages/*/src/**/*.{ts,tsx}"
---

# 코드 컨벤션

## 네이밍

| 대상          | 컨벤션                                                                                                             | 예시                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| 상수          | `UPPER_SNAKE_CASE`                                                                                                 | `ZOOM_LEVELS`, `API_BASE_URL`                    |
| 변수          | `camelCase`                                                                                                        | `userName`, `userList`                           |
| Boolean       | `is/has/should` + camelCase                                                                                        | `isModalActive`, `hasPermission`                 |
| 함수          | 화살표 함수 + camelCase                                                                                            | `const calculateTotal = () => {}`                |
| 이벤트 핸들러 | `handle[Action][Target]`                                                                                           | `handleClickAlert`, `handleSubmitForm`           |
| 콜백 prop     | `on` + camelCase                                                                                                   | `onSuccess`, `onComplete`                        |
| 폴더          | `camelCase` (`components/`, `lib/`, `hooks/` 등 모든 소스 폴더). 단 `app/` 라우트 폴더는 URL이 되므로 `kebab-case` | `imageMetadata`, `savedGlobe`, `app/saved-globe` |
| 컴포넌트 파일 | `PascalCase`                                                                                                       | `ImageMetadata.tsx`                              |
| 유틸/훅 파일  | `camelCase`                                                                                                        | `processFile.ts`, `useImage.ts`                  |
| 타입          | `PascalCase`                                                                                                       | `DiaryResponse`                                  |

## TypeScript / React

| 항목        | 허용                           | 금지                        |
| ----------- | ------------------------------ | --------------------------- |
| 타입 선언   | `type User = { ... }`          | `interface User { ... }`    |
| 타입 확장   | `type A = B & { ... }`         | `interface A extends B`     |
| any         | 구체 타입, `unknown`           | `any`                       |
| 함수        | `const fn = () => {}`          | `function fn() {}`          |
| 컴포넌트    | `const MyComponent = () => {}` | `function MyComponent() {}` |
| map key     | `key={item.id}`                | `key={index}`               |
| Props       | `({ id, name }: Props)`        | `(props: Props)`            |
| import 경로 | 같은 폴더 `./A`, 그 외 `@/...` | `../../utils/cn`            |

### Next.js 특수 파일 예외

아래 파일의 **Next.js가 호출하는 진입점**은 `export default function` / `export async function` 선언을 허용한다. 같은 파일 안의 다른 헬퍼는 화살표 함수를 쓴다.

`page.tsx`, `layout.tsx`, `template.tsx`, `loading.tsx`, `error.tsx`, `global-error.tsx`, `not-found.tsx`, `default.tsx`, `route.ts`(`GET`/`POST` 등), `middleware.ts`, `instrumentation*.ts`, `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`

- 클라이언트 컴포넌트는 파일 최상단에 `"use client"`.
- 컴포넌트는 셀프 클로징(`<Component />`).

## 코드 배치 순서

1. imports (ESLint `simple-import-sort` 순서)
2. Prop 타입
3. React 훅: `useState` → `useRef` → `useMemo` → `useCallback`
4. 변수 (`const` 먼저)
5. 함수: 헬퍼 → 이벤트 핸들러
6. 커스텀 훅 → `useEffect`

## 일반 패턴

- Early return. 삼항 연산자 중첩은 1단계까지.
- 구조분해 할당 사용. `const` 우선, `var` 금지.
- `?.`, `??` 적극 사용.
- 3회 이상 반복되기 전에는 추상화하지 않는다.
- 유효성 검사는 시스템 경계(API 응답, 사용자 입력)에서만.
- 미사용 변수·import·주석 처리된 코드는 남기지 않는다.
- SSR 비호환 라이브러리는 `dynamic(() => import(...), { ssr: false })` (`env-ssr.md`).
- 명령형 API가 필요하면 `forwardRef` + `useImperativeHandle`, `displayName` 지정.

## 주석

- 주석은 한국어로 쓴다. "무엇"보다 "왜"를 적는다.
- `apps/web/src/` 소스에는 em dash(`—`)를 쓰지 않고 하이픈(`-`)을 쓴다. 작성 시 Hook(`block-em-dash-in-source.sh`)과 pre-commit(`scripts/check-em-dash-in-source.sh`)이 막는다.
- 공개 유틸 함수에는 JSDoc(`@param`, `@returns`, 필요 시 `@example`).

## 검사

```bash
pnpm typecheck   # pre-push 훅과 동일
pnpm check               # eslint + prettier --check
pnpm fix                 # eslint --fix + prettier --write
```
