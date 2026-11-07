---
paths:
  - "apps/web/src/**/*.tsx"
  - "apps/web/src/**/*.css"
  - "apps/web/src/styles/**"
  - "tokens.json"
---

# 스타일 · 디자인 시스템

TailwindCSS v4. 토큰은 `apps/web/src/app/globals.css`의 `@theme inline`에 있고 `tokens.json` → `pnpm tokens:build`로 생성한다.

## 기본 원칙

1. 색상·간격·형태는 토큰/표준 클래스를 쓴다. 임의값 `[]`는 아래 예외에서만.
2. 폰트: Pretendard Variable.
3. 모바일 퍼스트, 최대 너비 512px(`max-w-128`). 반응형은 기본 → `sm:` → `md:` 순.
4. 변형은 CVA, 클래스 병합은 `cn()`(`utils/cn.ts`, clsx + tailwind-merge).

## 색상 토큰

| 역할        | 클래스                                                                    |
| ----------- | ------------------------------------------------------------------------- |
| 브랜드      | `bg-blue-theme`, `text-blue-theme`                                        |
| 배경        | `bg-surface-primary`, `bg-surface-secondary`, `bg-surface-placeholder--8` |
| 텍스트      | `text-text-primary`, `text-text-secondary`                                |
| 경고        | `text-red-warning`, `bg-state-warning`                                    |
| 회색 스케일 | `gray-0` ~ `gray-1000`, 투명도 `gray-0--16` 등                            |

토큰에 있는 색을 `bg-[#...]`로 쓰지 않는다.

## 간격 · 크기

- v4 기본 spacing은 1단위 = 4px이고 0.5 단위까지 쓸 수 있다: `w-9`=36px, `h-7.5`=30px, `p-4`=16px.
- 4px 또는 2px로 나누어떨어지는 px 값은 반드시 표준 클래스로 쓴다 (`w-[36px]` 금지 → `w-9`).
- 512px 컨테이너는 `max-w-128`.

## 둥글기 (v4 기본값)

| 클래스        | 값          |
| ------------- | ----------- |
| `rounded-xs`  | 2px         |
| `rounded-sm`  | 4px         |
| `rounded-md`  | 6px         |
| `rounded-lg`  | 8px         |
| `rounded-xl`  | 12px        |
| `rounded-2xl` | 16px (버튼) |
| `rounded-3xl` | 24px        |

## 임의값 허용 예외

1. 대응하는 표준 클래스가 없는 값(홀수 px 등, 디자인 명세의 정확한 값).
2. 폰트 크기·행간: `text-sm` 등은 line-height까지 바꾸므로 Figma 값이 다르면 `text-[13px] leading-[18px]`를 허용.
3. 외부 라이브러리 CSS 변수, `env(safe-area-inset-*)` 같은 CSS 함수.

## cn

```tsx
// 조건부 클래스가 있을 때만 cn
<div className={cn("flex items-center gap-2", isActive && "bg-blue-theme", className)} />
// 고정 문자열은 그대로
<div className="flex items-center gap-2" />
```

## CVA

```typescript
export const buttonVariants = cva("inline-flex items-center justify-center rounded-2xl disabled:opacity-40", {
  variants: {
    variant: { primary: "bg-blue-theme text-black", gray: "bg-surface-button-gray text-white" },
    size: { sm: "h-7.5 px-2 py-1.5 text-xs", md: "h-9 px-2.5 py-2 text-sm", lg: "h-14 px-3 py-4.5 text-lg font-bold" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});
```

- 첫 인자는 일반 문자열(백틱 금지), `defaultVariants` 필수.

## 접근성

- 인터랙티브 요소는 `button`/`a` 등 시맨틱 태그. 아이콘 버튼에는 `aria-label`.
- 의미 있는 이미지에는 `alt`.

모노레포 공용 토큰 원본은 `packages/tokens/tokens.json`, 빌드 스크립트는 `packages/tokens/scripts/build-tokens.js`다. 웹 CSS 생성 위치는 `apps/web/src/app/globals.css`다.
