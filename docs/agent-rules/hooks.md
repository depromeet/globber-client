---
paths:
  - "apps/web/src/hooks/**"
  - "apps/web/src/**/use*.ts"
---

# 커스텀 훅

1. 복잡한 상태 로직은 커스텀 훅으로 분리한다.
2. 이름은 `use{Feature}`. 컴포넌트 전용 훅은 `components/{feature}/hooks/`에 둔다.
3. 내부 순서: `useState` → `useRef` → `useMemo` → `useCallback` → `useEffect`.
4. 의존성 배열을 정확히 적는다. 의도적으로 뺄 때는 `eslint-disable-next-line react-hooks/exhaustive-deps`와 함께 이유를 주석으로 남긴다.
5. `useEffect`는 외부 시스템 동기화(이벤트 리스너, 타이머, DOM API)에만 쓴다. 파생 상태는 렌더 중 계산하거나 `useMemo`.
6. 리스너·타이머·Object URL은 cleanup에서 해제한다(`removeEventListener`, `clearTimeout`, `URL.revokeObjectURL`).

## 주요 훅

| 훅                    | 용도                      |
| --------------------- | ------------------------- |
| `useGlobeState`       | 지구본 줌/선택 상태       |
| `useClustering`       | 국가/도시 클러스터링      |
| `useImage`            | 이미지 업로드/관리        |
| `useCitySearch`       | 도시 검색                 |
| `useGoogleMapsScript` | Google Maps 스크립트 로드 |
| `useRecordScroll`     | 기록 화면 스크롤          |
| `useOwnerToast`       | 소유자 토스트             |
| `hooks/mutation/*`    | 서버 변경 (`api.md`)      |

## 반환 형태

```typescript
return {
  // state
  selectedCountry,
  zoomLevel,
  // handlers
  handleCountrySelect,
  handleZoomChange,
};
```
