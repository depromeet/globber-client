/**
 * @file labelRenderer.ts
 * @description Globe 라벨 HTML 엘리먼트 렌더링 및 위치 계산
 * @responsibility 클러스터 라벨 HTML 생성, 라벨 위치 계산
 */

import { escapeHtml } from "@globber/shared/utils/htmlEscape";

import { IMAGE_LOAD_ERROR_MESSAGE } from "@/constants/image";
import type { ClusterData } from "@/types/clustering";

import { calculateCityLabelWidth, calculateCountryLabelWidth } from "./calculations";
import type { createContinentClusterStyles, createCountryClusterStyles, createSingleLabelStyles } from "./labelStyles";

export type CityStyles = ReturnType<typeof createSingleLabelStyles>;
export type ContinentClusterStyles = ReturnType<typeof createContinentClusterStyles>;
export type CountryClusterStyles = ReturnType<typeof createCountryClusterStyles>;

// ============================================
// SVG 아이콘 상수
// ============================================

/**
 * 우측 액션 버튼 SVG - 국가 클러스터용 (그라디언트 border)
 */
const PLUS_BUTTON_SVG_COUNTRY = `<svg width="37" height="44" viewBox="0 0 37 44" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6.84742" y="0.564721" width="29" height="39" rx="3.5" transform="rotate(8 6.84742 0.564721)" fill="#112036"/>
  <rect x="6.84742" y="0.564721" width="29" height="39" rx="3.5" transform="rotate(8 6.84742 0.564721)" stroke="url(#paint0_linear_269_4694)"/>
  <path d="M17.2129 26.6421L17.758 22.7633L13.8796 22.2182C13.4694 22.1605 13.1836 21.7813 13.2413 21.3711C13.299 20.961 13.6782 20.6752 14.0884 20.7328L17.9668 21.2779L18.5118 17.3995C18.5695 16.9893 18.9488 16.7036 19.3589 16.7612C19.7691 16.8188 20.0549 17.1981 19.9972 17.6082L19.4522 21.4866L23.331 22.0318C23.7411 22.0895 24.0269 22.4688 23.9693 22.8788C23.9117 23.289 23.5324 23.5747 23.1223 23.5172L19.2434 22.972L18.6983 26.8509C18.6405 27.261 18.2613 27.5469 17.8512 27.4892C17.4411 27.4315 17.1553 27.0522 17.2129 26.6421Z" fill="#4A5E6D"/>
  <defs>
    <linearGradient id="paint0_linear_269_4694" x1="21.4219" y1="0" x2="21.4219" y2="40" gradientUnits="userSpaceOnUse">
      <stop stop-color="#B3DAFF"/>
      <stop offset="1" stop-color="#3C79B3"/>
    </linearGradient>
  </defs>
</svg>`;

/**
 * 우측 액션 버튼 SVG - 도시 클러스터용 (white border)
 */
const PLUS_BUTTON_SVG_CITY = `<svg width="37" height="44" viewBox="0 0 37 44" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6.84742" y="0.564721" width="29" height="39" rx="3.5" transform="rotate(8 6.84742 0.564721)" fill="#112036"/>
  <rect x="6.84742" y="0.564721" width="29" height="39" rx="3.5" transform="rotate(8 6.84742 0.564721)" stroke="white"/>
  <path d="M17.2129 26.6421L17.758 22.7633L13.8796 22.2182C13.4694 22.1605 13.1836 21.7813 13.2413 21.3711C13.299 20.961 13.6782 20.6752 14.0884 20.7328L17.9668 21.2779L18.5118 17.3995C18.5695 16.9893 18.9488 16.7036 19.3589 16.7612C19.7691 16.8188 20.0549 17.1981 19.9972 17.6082L19.4522 21.4866L23.331 22.0318C23.7411 22.0895 24.0269 22.4688 23.9693 22.8788C23.9117 23.289 23.5324 23.5747 23.1223 23.5172L19.2434 22.972L18.6983 26.8509C18.6405 27.261 18.2613 27.5469 17.8512 27.4892C17.4411 27.4315 17.1553 27.0522 17.2129 26.6421Z" fill="#4A5E6D"/>
</svg>`;

/**
 * 썸네일 로드 실패 시 보여 주는 이미지 아이콘 (lucide-react ImageOff와 같은 모양)
 */
const IMAGE_OFF_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <line x1="2" x2="22" y1="2" y2="22"/>
  <path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/>
  <line x1="13.5" x2="6" y1="13.5" y2="21"/>
  <line x1="18" x2="21" y1="12" y2="15"/>
  <path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59"/>
  <path d="M21 15V5a2 2 0 0 0-2-2H9"/>
</svg>`;

const THUMBNAIL_FALLBACK_HTML = `<div role="img" aria-label="${IMAGE_LOAD_ERROR_MESSAGE}" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #1c2d45; color: #778a9b; border-radius: 4px;">${IMAGE_OFF_SVG}</div>`;

// ============================================
// 썸네일 폴백
// ============================================

/** 로드에 실패한 썸네일 URL. 줌 등으로 라벨이 다시 만들어질 때 처음부터 폴백을 그리는 데 씁니다. */
const failedThumbnailUrls = new Set<string>();
/** 로드에 성공한 썸네일 URL. 다시 그릴 때 숨김 없이 바로 보여 줍니다. */
const loadedThumbnailUrls = new Set<string>();

/**
 * 썸네일 이미지 HTML을 만듭니다.
 * 실패한 적 있는 URL은 폴백을 바로 그리고, 결과를 아직 모르는 URL은 깨진 이미지 아이콘이
 * 잠깐 보이지 않도록 로드가 끝날 때까지 숨깁니다.
 *
 * @param thumbnailUrl - 썸네일 URL
 * @param alt - 대체 텍스트 (이스케이프된 값)
 */
const createThumbnailImageHTML = (thumbnailUrl: string, alt: string) => {
  if (failedThumbnailUrls.has(thumbnailUrl)) return THUMBNAIL_FALLBACK_HTML;

  const visibility = loadedThumbnailUrls.has(thumbnailUrl) ? "" : " opacity: 0;";
  return `<img src="${escapeHtml(thumbnailUrl)}" alt="${alt}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;${visibility}" data-thumb="true" />`;
};

/**
 * 라벨 컨테이너 안의 썸네일(`data-thumb`)이 로드되면 보여 주고, 실패하면 폴백으로 교체합니다.
 * load·error 이벤트는 버블링되지 않으므로 캡처 단계에서 받습니다.
 *
 * @param container - 라벨 HTML을 담는 컨테이너
 */
export const attachThumbnailFallback = (container: HTMLElement) => {
  container.addEventListener(
    "load",
    event => {
      const { target } = event;
      if (!(target instanceof HTMLImageElement) || target.dataset.thumb !== "true") return;
      const src = target.getAttribute("src");
      if (src) loadedThumbnailUrls.add(src);
      target.style.opacity = "";
    },
    true
  );

  container.addEventListener(
    "error",
    event => {
      const { target } = event;
      if (!(target instanceof HTMLImageElement) || target.dataset.thumb !== "true") return;
      const src = target.getAttribute("src");
      if (src) failedThumbnailUrls.add(src);
      target.outerHTML = THUMBNAIL_FALLBACK_HTML;
    },
    true
  );
};

// ============================================
// 위치 계산 함수
// ============================================

/**
 * 라벨 위치 계산 (클릭 기반 시스템용)
 * @param d - 클러스터 데이터
 * @param htmlElements - 전체 HTML 엘리먼트 배열
 * @returns 각도 오프셋 및 거리
 * @responsibility 클러스터 라벨의 표시 위치 결정
 *
 * @description
 * - ID 기반으로 왼쪽/오른쪽 결정 (인덱스가 홀수면 왼쪽)
 * - 고정 거리 사용 (100px)
 */
export const calculateLabelPosition = (d: ClusterData, htmlElements: ClusterData[]) => {
  const labelIndex = htmlElements.findIndex(({ id }) => id === d.id);
  const safeIndex = labelIndex >= 0 ? labelIndex : 0;
  const isLeftSide = safeIndex % 2 === 1;
  const angleOffset = isLeftSide ? 180 : 0;
  const fixedDistance = 100;

  return { angleOffset, dynamicDistance: fixedDistance };
};

// ============================================
// HTML 생성 함수
// ============================================

/**
 * 개별 도시 HTML 생성
 * @param styles - 도시 스타일
 * @param displayFlag - 표시할 국기 이모지
 * @param cityName - 도시명
 * @param hasRecords - 기록 존재 여부
 * @param thumbnailUrl - 썸네일 URL (선택)
 * @param isMyGlobe - 나의 지구본 여부
 * @param isFirstGlobe - 최초 지구본 여부
 * @param recordCount - 해당 도시의 총 여행 기록 개수 (선택)
 * @returns 도시 HTML 문자열
 * @responsibility 개별 도시 마커 HTML 생성
 *
 * @description
 * - 기록 없음 + 타인의 지구본/최초 지구본: + 버튼 없음
 * - 기록 없음 + 나의 지구본: + 버튼 표시
 * - 기록 있음: 썸네일 이미지 표시 (기록이 2개 이상이면 딤드 + "+N" 뱃지 표시)
 */
export const createCityHTML = (
  styles: CityStyles,
  displayFlag: string,
  cityName: string,
  hasRecords: boolean = true,
  thumbnailUrl?: string,
  isMyGlobe: boolean = true,
  isFirstGlobe: boolean = false,
  recordCount?: number
) => {
  const { dot, horizontalLine, label, actionButton, thumbnailCard } = styles;

  const labelWidth = calculateCityLabelWidth(cityName);
  const safeFlag = escapeHtml(displayFlag);
  const safeCityName = escapeHtml(cityName);

  // 기록이 없는 경우
  if (!hasRecords) {
    // 타인의 지구본이거나 최초 지구본인 경우: + 버튼 표시하지 않음
    if (!isMyGlobe || isFirstGlobe) {
      const cursorStyle = !isMyGlobe && !hasRecords ? "cursor: default;" : "";

      return `
        <!-- 중심 dot -->
        <div style="${dot}"></div>
        <!-- 점선 -->
        <div style="${horizontalLine}"></div>
        <div style="${label} ${cursorStyle}">
          <!-- 좌측 국기 이모지 -->
          <span style="font-size: 16px; line-height: 16px; pointer-events: none;">${safeFlag}</span>
          <!-- 도시명 -->
          <span>
            ${safeCityName}
          </span>
        </div>
      `;
    }

    // 나의 지구본인 경우: + 버튼 표시
    return `
      <!-- 중심 dot -->
      <div style="${dot}"></div>
      <!-- 점선 -->
      <div style="${horizontalLine}"></div>
      <div style="${label}">
        <!-- 좌측 국기 이모지 -->
        <span style="font-size: 16px; line-height: 16px; pointer-events: none;">${safeFlag}</span>
        <!-- 도시명 -->
        <span>
          ${safeCityName}
        </span>
      </div>
      <!-- 우측 액션 버튼 (+ 아이콘) -->
      <div style="${actionButton(labelWidth / 2)}" role="button" aria-label="도시 추가" tabindex="0">
        ${PLUS_BUTTON_SVG_CITY}
      </div>
    `;
  }

  // 기록이 있는 경우: 썸네일 이미지 표시
  return `
    <!-- 중심 dot -->
    <div style="${dot}"></div>
    <!-- 점선 -->
    <div style="${horizontalLine}"></div>
    <div style="${label}">
      <!-- 좌측 국기 이모지 -->
      <span style="font-size: 16px; line-height: 16px; pointer-events: none;">${safeFlag}</span>
      <!-- 도시명 -->
      <span>
        ${safeCityName}
      </span>
    </div>
    <!-- 우측 썸네일 이미지 카드 -->
    ${
      thumbnailUrl
        ? `<div style="${thumbnailCard(labelWidth / 2)}">
      ${createThumbnailImageHTML(thumbnailUrl, `${safeCityName} 여행 기록 썸네일`)}
      ${
        recordCount && recordCount > 1
          ? `<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.2); border-radius: 4px; pointer-events: none;">
        <span style="color: #fff; font-size: 12px; font-weight: 700; letter-spacing: -0.24px;">+${recordCount - 1}</span>
      </div>`
          : ""
      }
    </div>`
        : ""
    }
  `;
};

/**
 * 대륙 클러스터 HTML 생성
 * @param styles - 대륙 클러스터 스타일
 * @param continentName - 대륙명
 * @returns 대륙 클러스터 HTML 문자열
 * @responsibility 대륙 클러스터 HTML 생성
 *
 * @description
 * - 국기 표시 안함 (텍스트만)
 * - 그라디언트 border 적용
 */
export const createContinentClusterHTML = (styles: ContinentClusterStyles, continentName: string) => {
  const { labelWrapper, label } = styles;
  const safeContinentName = escapeHtml(continentName);

  return `
    <!-- 외부 wrapper - 그라디언트 border -->
    <div style="${labelWrapper}">
      <!-- 내부 label - 실제 콘텐츠 -->
      <div style="${label}">
        <!-- 대륙명만 표시 (국기 없음) -->
        <span>
          ${safeContinentName}
        </span>
      </div>
    </div>
  `;
};

/**
 * 국가 클러스터 HTML 생성
 * @param styles - 국가 클러스터 스타일
 * @param countryName - 국가명
 * @param cityCount - 도시 개수
 * @param flagEmoji - 국기 이모지
 * @param hasRecords - 기록 존재 여부
 * @param thumbnailUrl - 썸네일 URL (선택)
 * @param isMyGlobe - 나의 지구본 여부
 * @param isFirstGlobe - 최초 지구본 여부
 * @returns 국가 클러스터 HTML 문자열
 * @responsibility 국가 클러스터 HTML 생성
 *
 * @description
 * - 기록 없음 + 타인의 지구본/최초 지구본: + 버튼 없음
 * - 기록 없음 + 나의 지구본: + 버튼 표시
 * - 기록 있음: 썸네일 이미지 표시
 * - 도시 개수 배지는 1개 이상일 때만 표시
 */
export const createCountryClusterHTML = (
  styles: CountryClusterStyles,
  countryName: string,
  cityCount: number,
  flagEmoji: string,
  hasRecords: boolean = true,
  thumbnailUrl?: string,
  isMyGlobe: boolean = true,
  isFirstGlobe: boolean = false
) => {
  const { dot, horizontalLine, label, countBadge, actionButton, thumbnailCard } = styles;

  const labelWidth = calculateCountryLabelWidth(countryName, cityCount);
  const safeFlag = escapeHtml(flagEmoji);
  const safeCountryName = escapeHtml(countryName);

  // 모든 도시 미기록 시
  if (!hasRecords) {
    // 타인의 지구본이거나 최초 지구본인 경우: + 버튼 표시하지 않음
    if (!isMyGlobe || isFirstGlobe) {
      return `
        <!-- 중심 dot -->
        <div style="${dot}"></div>
        <!-- 단색 수평선 -->
        <div style="${horizontalLine}"></div>
        <div style="${label}">
          <!-- 좌측 국기 이모지 -->
          <span style="font-size: 16px; line-height: 16px; pointer-events: none;">${safeFlag}</span>
          <!-- 국가명 -->
          <span>
            ${safeCountryName}
          </span>
          <!-- 도시 개수 원형 배지 (1개 이상일 때 표시) -->
          ${
            cityCount >= 1
              ? `<div style="${countBadge}">
            <span>
              ${cityCount}
            </span>
          </div>`
              : ""
          }
        </div>
      `;
    }

    // 나의 지구본인 경우: + 버튼 표시
    return `
      <!-- 중심 dot -->
      <div style="${dot}"></div>
      <!-- 단색 수평선 -->
      <div style="${horizontalLine}"></div>
      <div style="${label}">
        <!-- 좌측 국기 이모지 -->
        <span style="font-size: 16px; line-height: 16px; pointer-events: none;">${safeFlag}</span>
        <!-- 국가명 -->
        <span>
          ${safeCountryName}
        </span>
        <!-- 도시 개수 원형 배지 (1개 이상일 때 표시) -->
        ${
          cityCount >= 1
            ? `<div style="${countBadge}">
          <span>
            ${cityCount}
          </span>
        </div>`
            : ""
        }
      </div>
      <!-- 우측 액션 버튼 (+ 아이콘) -->
      <div style="${actionButton(labelWidth / 2)}">
        ${PLUS_BUTTON_SVG_COUNTRY}
      </div>
    `;
  }

  // 해당 국가 내 1개 이상의 도시 기록 시: 카드형 마커 (썸네일 이미지 포함)
  return `
    <!-- 중심 dot -->
    <div style="${dot}"></div>
    <!-- 단색 수평선 -->
    <div style="${horizontalLine}"></div>
    <div style="${label}">
      <!-- 좌측 국기 이모지 -->
      <span style="font-size: 16px; line-height: 16px; pointer-events: none;">${safeFlag}</span>
      <!-- 국가명 -->
      <span>
        ${safeCountryName}
      </span>
      <!-- 도시 개수 원형 배지 (1개 이상일 때 표시) -->
      ${
        cityCount >= 1
          ? `<div style="${countBadge}">
        <span>
          ${cityCount}
        </span>
      </div>`
          : ""
      }
    </div>
    <!-- 우측 썸네일 이미지 카드 -->
    ${
      thumbnailUrl
        ? `<div style="${thumbnailCard(labelWidth / 2)}">
       ${createThumbnailImageHTML(thumbnailUrl, `${safeCountryName} 여행 기록 썸네일`)}
    </div>`
        : ""
    }
  `;
};
