# Globber Project - 개발 규칙 상세 문서

## 1. 일반 규칙

| 카테고리        | 규칙                                                                                   |
| --------------- | -------------------------------------------------------------------------------------- |
| **언어**        | **규칙 1.1**: 사용자와의 모든 상호작용은 **한국어**로 해야 합니다.                     |
|                 | **규칙 1.2**: 코드 주석, 문서, 커밋 메시지는 **영어**로 작성해야 합니다.               |
| **Git 커밋**    | **규칙 1.3**: `git commit` 또는 `git push` 명령을 **절대 자동으로 실행하지 않습니다**. |
|                 | **규칙 1.4**: 사용자가 명시적으로 요청할 때만 파일을 스테이징합니다.                   |
| **파일 시스템** | **규칙 1.5**: **기존 파일 수정**을 항상 우선시합니다. 새 파일 생성은 최소화합니다.     |
|                 | **규칙 1.6**: `.md`, `README` 등 문서 파일을 **절대 미리 생성하지 않습니다**.          |
|                 | **규칙 1.7**: Windows 파일 경로는 **백슬래시(`\`)**를 사용해야 합니다.                 |

## 2. 코드 스타일 규칙

### **규칙 2.1: TypeScript**

| 항목           | ✅ 허용 (Good)                        | ❌ 금지 (Bad)            |
| -------------- | ------------------------------------- | ------------------------ |
| **타입 선언**  | `type User = { ... };`                | `interface User { ... }` |
| **`any` 사용** | `const data: KnownType = ...`         | `const data: any = ...`  |
| **함수**       | `const App = () => { ... }`           | `function App() { ... }` |
| **반환 타입**  | `const getNum = () => 1;` (추론 활용) | 불필요한 반환 타입 명시  |

### **규칙 2.2: React**

| 항목         | ✅ 허용 (Good)                                       | ❌ 금지 (Bad)                                              |
| ------------ | ---------------------------------------------------- | ---------------------------------------------------------- |
| **컴포넌트** | `const MyComponent = () => { ... }`                  | `function MyComponent() { ... }`                           |
| **지시어**   | `'use client';` (파일 최상단)                        | 클라이언트 컴포넌트에서 지시어 누락                        |
| **반복**     | `items.map(item => <div key={item.id} />)`           | `items.map((item, index) => <div key={index} />)`          |
| **구조분해** | `const Component = ({ id, name }: Props) => { ... }` | `const Component = (props: Props) => { ... props.id ... }` |

### **규칙 2.3: 네이밍**

| 타입                | 컨벤션             | 예시                                |
| ------------------- | ------------------ | ----------------------------------- |
| **컴포넌트/타입**   | `PascalCase`       | `GlobeHeader`, `DiaryDetail`        |
| **함수/변수**       | `camelCase`        | `handleZoomChange`, `isZoomed`      |
| **상수**            | `UPPER_SNAKE_CASE` | `ZOOM_LEVELS`, `API_BASE_URL`       |
| **폴더**            | `kebab-case`       | `image-metadata`, `nation-select`   |
| **파일 (컴포넌트)** | `PascalCase`       | `GlobeHeader.tsx`, `RecordCard.tsx` |
| **파일 (유틸)**     | `camelCase`        | `globeUtils.ts`, `dateUtils.ts`     |

### **규칙 2.4: Import 경로**

| 상황             | ✅ 허용 (Good)                  | ❌ 금지 (Bad)                              |
| ---------------- | ------------------------------- | ------------------------------------------ |
| **같은 폴더 내** | `import A from './ComponentA';` | `import A from '@/components/ComponentA';` |
| **다른 폴더**    | `import cn from '@/utils/cn';`  | `import cn from '../../utils/cn';`         |

## 3. 아키텍처 및 품질 규칙

| 카테고리          | 규칙                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| **추상화**        | **규칙 3.1**: 3번 이상 반복되는 코드가 나타나기 전까지 추상화하지 않습니다.                                |
| **유효성 검사**   | **규칙 3.2**: 데이터 유효성 검사는 시스템 경계(API 응답, 사용자 입력)에서만 수행합니다.                    |
| **불필요한 코드** | **규칙 3.3**: 사용되지 않는 변수, 함수, import 구문은 즉시 제거합니다. 주석 처리된 코드를 남기지 않습니다. |
| **성능**          | **규칙 3.4**: `Early return` 패턴을 사용하여 불필요한 연산을 줄입니다.                                     |
| **코드 품질**     | **규칙 3.5**: `const` 사용을 `let`보다 우선시하며, `var`는 절대 사용하지 않습니다.                         |
|                   | **규칙 3.6**: 옵셔널 체이닝(`?.`)과 nullish 병합(`??`)을 적극적으로 사용합니다.                            |
|                   | **규칙 3.7**: 모든 컴포넌트는 셀프 클로징 (`<Component />`)을 원칙으로 합니다.                             |

---

# API 규칙

## 1. 기본 규칙

**규칙 1.1**: 모든 API 요청은 `lib/apiClient.ts`에 정의된 함수를 사용해야 합니다.

- `apiGet<T>()` - GET 요청
- `apiPost<T>()` - POST 요청
- `apiPut<T>()` - PUT 요청
- `apiPatch<T>()` - PATCH 요청
- `apiDelete<T>()` - DELETE 요청

**규칙 1.2**: Service 함수는 `services/` 디렉토리에 분리해야 합니다.

```typescript
// ✅ 허용 (Good) - services/diaryService.ts
export const getDiaryDetail = async (diaryId: string, token?: string): Promise<DiaryData> => {
  const response = await apiGet<DiaryDetailResponse>(`/api/v1/diaries/${diaryId}`, undefined, token);
  return response.data;
};

// ❌ 금지 (Bad) - 컴포넌트에서 직접 API 호출
const Component = () => {
  useEffect(() => {
    fetch('/api/v1/diaries/1').then(...)
  }, []);
};
```

## 2. 인증 토큰 처리

**규칙 2.1**: 서버 컴포넌트에서는 토큰을 파라미터로 전달합니다.

```typescript
// ✅ 허용 (Good) - 서버 컴포넌트
const Page = async () => {
  const token = await getServerToken();
  const data = await getDiaryDetail(id, token);
};
```

**규칙 2.2**: 클라이언트 컴포넌트에서는 `getAuthInfo()`를 사용합니다.

```typescript
// ✅ 허용 (Good) - 클라이언트 컴포넌트 또는 Service 함수 내부
const { token } = getAuthInfo();
if (!token) {
  throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
}
```

## 3. 에러 처리

**규칙 3.1**: `ApiError` 클래스를 사용하여 에러를 처리합니다.

```typescript
// lib/apiClient.ts에 정의됨
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
```

**규칙 3.2**: 401/500 에러는 전역 리다이렉트로 처리됩니다.

- 401: `/error?type=401`로 리다이렉트
- 500+: `/error?type=500`로 리다이렉트

## 4. 타입 정의 규칙

**규칙 4.1**: API 응답 타입은 `status`와 `data` 구조를 따릅니다.

```typescript
// ✅ 허용 (Good)
type DiaryDetailResponse = {
  status: string;
  data: DiaryData;
};

// Service 함수에서 data만 반환
export const getDiaryDetail = async (...): Promise<DiaryData> => {
  const response = await apiGet<DiaryDetailResponse>(...);
  return response.data;  // data만 반환
};
```

**규칙 4.2**: 타입 네이밍 패턴을 준수합니다.

| 용도                  | 패턴             | 예시                                         |
| --------------------- | ---------------- | -------------------------------------------- |
| **요청 파라미터**     | `[Name]Params`   | `CreateDiaryParams`, `UpdateDiaryParams`     |
| **API 응답 래퍼**     | `[Name]Response` | `DiaryDetailResponse`, `DiariesListResponse` |
| **실제 데이터**       | `[Name]Data`     | `DiaryData`, `CityData`                      |
| **클라이언트용 변환** | `[Name]Detail`   | `DiaryDetail`, `CityDetail`                  |

---

# Hooks 및 상태 관리 규칙

## 1. 커스텀 훅 작성 규칙

**규칙 1.1**: 복잡한 상태 로직은 커스텀 훅으로 분리합니다.

```typescript
// ✅ 허용 (Good) - 복잡한 로직을 훅으로 분리
export const useGlobeState = (patterns: TravelPattern[]) => {
  const [zoomLevel, setZoomLevel] = useState<number>(ZOOM_LEVELS.DEFAULT);
  const [selectedClusterData, setSelectedClusterData] = useState<CountryData[] | null>(null);

  // 복잡한 로직...

  return {
    zoomLevel,
    selectedClusterData,
    handleZoomChange,
    handleClusterSelect,
  };
};

// ❌ 금지 (Bad) - 컴포넌트에 복잡한 상태 로직 직접 작성
const Globe = () => {
  const [zoomLevel, setZoomLevel] = useState(2.5);
  const [selectedClusterData, setSelectedClusterData] = useState(null);
  // 100줄 이상의 상태 관리 로직...
};
```

**규칙 1.2**: 훅 내부 코드 순서를 준수합니다.

1. `useState` 선언
2. `useRef` 선언
3. `useMemo` 선언
4. `useCallback` 선언
5. 헬퍼 함수
6. `useEffect` 선언
7. 반환 객체

## 2. 최적화 규칙

**규칙 2.1**: 복잡한 계산은 `useMemo`로 최적화합니다.

```typescript
// ✅ 허용 (Good)
const topCountry = useMemo(() => {
  if (!currentPattern?.countries) return null;
  // 복잡한 정렬/필터 로직...
  return countryStats[0]?.country ?? null;
}, [currentPattern]);

// ❌ 금지 (Bad) - 매 렌더마다 재계산
const topCountry = (() => {
  if (!currentPattern?.countries) return null;
  // 복잡한 정렬/필터 로직...
})();
```

**규칙 2.2**: 이벤트 핸들러는 `useCallback`으로 메모이제이션합니다.

```typescript
// ✅ 허용 (Good)
const handleZoomChange = useCallback((newZoomLevel: number) => {
  setZoomLevel(newZoomLevel);
}, []);

// ❌ 금지 (Bad) - 매 렌더마다 새 함수 생성 (자식에게 전달 시)
const handleZoomChange = (newZoomLevel: number) => {
  setZoomLevel(newZoomLevel);
};
```

## 3. 반환 패턴

**규칙 3.1**: 훅의 반환 객체는 State와 Handlers를 구분합니다.

```typescript
return {
  // State
  selectedCountry,
  zoomLevel,
  isZoomed,

  // Computed/Derived State
  currentPattern,
  topCountry,

  // Handlers
  handleCountrySelect,
  handleZoomChange,
  handleClusterSelect,
  resetGlobe,
};
```

---

# 디자인 시스템 규칙

## 1. 색상 규칙

**규칙 1.1**: 모든 색상은 Tailwind 토큰을 사용합니다.

| 역할              | 클래스                                     | 용도                |
| ----------------- | ------------------------------------------ | ------------------- |
| **브랜드 주색**   | `bg-blue-theme`, `text-blue-theme`         | CTA 버튼, 강조 요소 |
| **배경 (기본)**   | `bg-surface-primary`                       | 페이지 배경         |
| **배경 (보조)**   | `bg-surface-secondary`                     | 카드, 모달 배경     |
| **텍스트 (기본)** | `text-text-primary`                        | 본문 텍스트         |
| **텍스트 (보조)** | `text-text-secondary`, `text-text-thirdly` | 캡션, 힌트          |
| **비활성**        | `text-gray-400`, `opacity-40`              | 비활성화된 요소     |

## 2. 컴포넌트 변형 (CVA)

**규칙 2.1**: 컴포넌트 변형은 CVA로 관리합니다.

```typescript
export const buttonVariants = cva(
  "inline-flex justify-center items-center rounded-2xl disabled:opacity-40 cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-blue-theme enabled:hover:bg-blue-200 text-black",
        gray: "bg-[#293949] enabled:hover:bg-gray-1000 text-white",
        black: "bg-[#0C0D15] enabled:hover:bg-gray-1000 text-white",
        disabled: "bg-[#243146] text-text-thirdly",
      },
      size: {
        xs: "p-1 h-6 text-xs",
        sm: "px-2 py-1.5 h-[30px] text-xs",
        md: "px-2.5 py-2 h-9 text-sm",
        lg: "px-3 py-4.5 h-14 text-lg font-bold rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);
```

## 3. cn 유틸리티 사용

**규칙 3.1**: 조건부 클래스에만 `cn()` 사용합니다.

```typescript
// ✅ 허용 (Good) - 조건부 클래스
<button
  className={cn(
    "flex items-center gap-2 px-4 py-3 rounded-full",
    isActive && "bg-blue-500",
    disabled && "opacity-40 cursor-not-allowed",
    className
  )}
/>

// ❌ 금지 (Bad) - 단순 문자열에 cn 불필요
<div className={cn("flex items-center")} />

// ✅ 허용 (Good) - 직접 문자열 사용
<div className="flex items-center" />
```

---

# Tailwind CSS 규칙

## 1. 표준 문법 사용

**규칙 1.1**: Tailwind 표준 클래스를 우선 사용합니다.

| 항목                    | ✅ 허용 (Good)              | ❌ 금지 (Bad)                       |
| ----------------------- | --------------------------- | ----------------------------------- |
| **크기**                | `w-36`, `h-20`              | `w-[36px]`, `h-[20px]`              |
| **패딩/마진**           | `p-4`, `m-2`, `gap-8`       | `p-[16px]`, `m-[8px]`               |
| **색상 (토큰 있을 때)** | `bg-gray-800`, `text-white` | `bg-[#1f2937]`                      |
| **둥글기**              | `rounded-lg`, `rounded-2xl` | `rounded-[12px]`                    |
| **그림자**              | `shadow-lg`                 | `shadow-[0_0_10px_rgba(0,0,0,0.1)]` |

## 2. 임의 값 허용 케이스

**규칙 2.1**: 다음 경우에만 임의 값 `[]` 사용이 허용됩니다.

1. **디자인 명세의 정확한 값이 필요한 경우**

   ```typescript
   // 디자인에서 정확히 293949 색상을 요구
   <div className="bg-[#293940]" />
   ```

2. **Tailwind에 사전 정의되지 않은 값**

   ```typescript
   // 512px는 Tailwind 기본값에 없음
   <div className="max-w-[523px]" />
   ```

3. **외부 라이브러리 CSS 변수 사용**
   ```typescript
   <div className="h-(--header-height)" />
   ```

## 3. 반응형 디자인

**규칙 3.1**: 모바일 퍼스트로 작성합니다.

```typescript
// ✅ 허용 (Good) - 모바일 먼저, 큰 화면으로 확장
<div className="w-full sm:w-1/2 md:w-1/3 lg:w-1/4" />

// ❌ 금지 (Bad) - 큰 화면 먼저
<div className="w-1/4 md:w-1/3 sm:w-1/2" />
```

---

# 프로젝트 구조 규칙

## 1. 디렉토리 구조

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API 라우트
│   ├── globe/             # 지구본 페이지
│   ├── record/            # 여행 기록 페이지
│   └── ...
├── components/             # 재사용 컴포넌트
│   ├── common/            # 공통 UI (Button, Input, Dialog)
│   ├── globe/             # 지구본 관련
│   ├── imageMetadata/     # 이미지 메타데이터
│   └── ...
├── config/                 # 설정 파일
│   └── env.ts             # 환경변수 중앙 관리
├── constants/              # 상수 정의
├── hooks/                  # 커스텀 훅
├── lib/                    # 라이브러리 설정
│   ├── apiClient.ts       # API 클라이언트
│   └── processFile.ts     # 파일 처리
├── services/               # API 서비스 레이어
├── styles/                 # 스타일 유틸리티
├── types/                  # TypeScript 타입
├── utils/                  # 유틸리티 함수
└── middleware.ts           # Next.js 미들웨어
```

## 2. 주요 규칙

| 경로                    | 규칙                                          |
| ----------------------- | --------------------------------------------- |
| `components/common/`    | 2개 이상 페이지에서 사용되는 UI만             |
| `components/[feature]/` | 특정 기능에 종속된 컴포넌트                   |
| `services/`             | 모든 API 호출, `lib/apiClient.ts` 사용 필수   |
| `hooks/`                | 복잡한 상태 로직만, 단순 로직은 컴포넌트 내부 |
| `types/`                | 4개 이상 속성 시 별도 파일로 분리             |
| `constants/`            | 매직 넘버 금지, 상수 파일로 분리              |
| `config/env.ts`         | 모든 환경변수 중앙 관리                       |

---

# 환경변수 규칙 (🔴 CRITICAL)

## 1. 환경변수 패턴

**규칙 1.1**: 클라이언트/서버 환경변수를 구분합니다.

```bash
# 서버 전용 (API 라우트, 서버 컴포넌트)
GOOGLE_MAPS_API_KEY=your_key_here

# 클라이언트 접근 가능
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
NEXT_PUBLIC_S3_BASE_URL=https://s3.example.com
```

**규칙 1.2**: 환경변수는 `config/env.ts`에서 중앙 관리합니다.

```typescript
// config/env.ts
export const env = {
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "https://globber.world/api",
  REDIRECT_ORIGIN: process.env.NEXT_PUBLIC_REDIRECT_ORIGIN || "https://www.globber.world",
  COOKIE_DOMAIN: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || ".globber.world",
  IS_LOCAL_DEV: process.env.NODE_ENV === "development",
} as const;
```

---

# SSR 및 동적 임포트 규칙

## 1. SSR 호환성

**규칙 1.1**: SSR 비호환 라이브러리는 동적 임포트를 사용합니다.

```typescript
// ✅ 허용 (Good) - Globe.gl은 SSR 비호환
const GlobeComponent = dynamic(() => import("react-globe.gl"), {
  ssr: false,
});

// ❌ 금지 (Bad) - 직접 임포트
import Globe from "react-globe.gl";
```

**규칙 1.2**: `window` 객체 접근 전 가드를 추가합니다.

```typescript
// ✅ 허용 (Good)
useEffect(() => {
  if (typeof window === "undefined") return;

  const handleResize = () => {
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  };

  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);
```

## 2. forwardRef 패턴

**규칙 2.1**: 명령형 API가 필요한 컴포넌트는 `forwardRef`를 사용합니다.

```typescript
export interface GlobeRef {
  globeRef: React.RefObject<GlobeInstance | null>;
  resetGlobe: () => void;
}

const Globe = forwardRef<GlobeRef, GlobeProps>(
  (props, ref) => {
    const globeRef = useRef<GlobeInstance | null>(null);

    useImperativeHandle(ref, () => ({
      globeRef,
      resetGlobe: () => {
        // 리셋 로직
      },
    }));

    return <GlobeComponent ref={globeRef} />;
  },
);

Globe.displayName = "Globe";
```

---

# PR 리뷰 체크리스트

## 1. 코드 품질 및 컨벤션

- **[ ] TypeScript 규칙**:
  - `any` 타입을 사용하지 않았는가?
  - `interface` 대신 `type`을 사용했는가?
  - 모든 Props와 API 응답에 대한 타입이 정의되었는가?
- **[ ] React/Next.js 규칙**:
  - 컴포넌트는 화살표 함수로 작성되었는가?
  - 클라이언트 컴포넌트 최상단에 `'use client'`가 있는가?
  - `map` 렌더링 시 `index`를 `key`로 사용하지 않았는가?
  - SSR 비호환 라이브러리에 동적 임포트를 사용했는가?
- **[ ] 코드 스타일 규칙**:
  - 네이밍 컨벤션(PascalCase, camelCase, UPPER_SNAKE_CASE)을 준수했는가?
  - Props, 배열 콜백 등에서 구조분해할당을 사용했는가?
  - 사용하지 않는 변수, import가 모두 제거되었는가?

## 2. 성능 및 보안

- **[ ] 성능 규칙**:
  - `useMemo`/`useCallback`이 적절히 사용되었는가?
  - `Early return` 패턴이 적용되었는가?
  - 불필요한 리렌더링이 없는가?
- **[ ] 보안 규칙**:
  - API 경계에서 데이터 유효성 검사를 수행하는가?
  - 환경변수가 올바른 패턴(NEXT*PUBLIC* 등)으로 사용되었는가?
  - 인증이 필요한 페이지가 미들웨어로 보호되고 있는가?

## 3. UI 및 접근성

- **[ ] 디자인 시스템 규칙**:
  - 모든 색상, 간격이 Tailwind 토큰을 사용하는가?
  - CVA로 컴포넌트 변형을 관리하는가?
  - 임의 값 사용이 최소화되었는가?
- **[ ] 접근성 규칙**:
  - 모든 인터랙티브 요소가 키보드로 접근 가능한가?
  - 중요한 이미지에 `alt` 텍스트가 있는가?
  - `aria-label` 등 적절한 ARIA 속성이 사용되었는가?

## 4. 최종 승인 조건

- **[ ] 자동화 검사**: Biome 린트/포맷, TypeScript 검사 통과
- **[ ] 요구사항**: PR이 원래 요청된 모든 요구사항 충족
- **[ ] 모바일 호환성**: 512px 뷰포트에서 정상 작동

---

_하나라도 체크되지 않은 항목이 있다면, PR은 `changes requested` 상태가 됩니다._
