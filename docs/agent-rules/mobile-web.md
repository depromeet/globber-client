---
paths:
  - "apps/web/src/**/*.tsx"
  - "apps/web/src/**/*.css"
---

# 모바일 웹 함정

실사용 환경은 iOS Safari와 Android Chrome이다. 아래 항목은 실제로 버그가 났다가 고친 패턴이다(커밋 이력 근거). 같은 종류의 UI를 만들거나 고칠 때 먼저 확인한다. 새 패턴을 고치면 이 문서에 추가한다.

## 입력 · 줌

- iOS는 font-size 16px 미만 input에 포커스하면 화면을 자동 확대한다. 루트 `layout.tsx`는 접근성 때문에 확대를 허용(`maximumScale: 5`)하고, 텍스트 입력이 있는 화면만 해당 `page.tsx`에서 `viewport`를 덮어써 막는다(`app/image-metadata/page.tsx` 참고). 새 입력 화면을 만들면 같은 방식으로 처리하거나 input을 16px 이상으로 한다. (#211)
- 입력 화면의 헤더는 키보드가 올라와도 밀리지 않게 `sticky top-0`. (#211)
- 하단 고정 UI(이모지 피커, 저장 버튼)는 키보드와 겹친다. Android는 `window.visualViewport`의 `resize`로 키보드 높이를 계산해 띄우고, iOS 홈 인디케이터는 `paddingBottom: env(safe-area-inset-bottom)`. (이모지 피커 키보드 겹침 수정)

## 이미지 길게 누르기 · 드래그

- 길게 누르면 브라우저 "이미지 저장" 메뉴가 뜬다. 드래그 가능한 이미지 영역에는 `.dnd-no-image-menu` 클래스(globals.css: `-webkit-touch-callout: none`, `user-select: none`, `img { pointer-events: none }`)와 `onContextMenu={e => e.preventDefault()}`를 함께 건다. (#212, #216)
- `next/image`에는 `draggable={false}`. (#195)

## 드래그 앤 드롭 (dnd-kit)

- 센서는 `PointerSensor` 하나로 통일한다. `TouchSensor`/`MouseSensor` 분기는 Android에서 동작하지 않았다. 현재 기준값 `delay: 500, tolerance: 15`. (#207)
- 가로 스크롤 컨테이너 안의 드래그 아이템은 `touchAction: "none"`이 되면 스크롤이 막힌다. 드래그 중이 아닐 때는 `onTouchMove`에서 직접 `scrollLeft`를 갱신한다. (#202, #204, cc249fd)

## HEIC 이미지

- iPhone 사진은 HEIC다. S3 업로드 전에 `heic2any`로 JPEG 변환한다(`lib/processFile.ts`). import는 동적으로: `const { default: heic2any } = await import("heic2any")`. (#206)
- 변환이 실패하면 원본 HEIC를 올리지 말고 실패로 처리해 사용자에게 알린다. (2cea0f0)
- 미리보기 Object URL은 교체·언마운트 시 `URL.revokeObjectURL`.

## 스크롤

- 스크롤바는 전역으로 숨긴다. 가로 스크롤 영역은 PC에서도 스크롤바가 보이지 않게 확인한다.

## 확인 방법

변경 후 `mobile-qa` Skill 절차로 512px 폭, iOS/Android 에뮬레이션에서 확인한다.
