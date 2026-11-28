/** 검색 엔진과 공유 미리보기에 쓰는 대표 주소로, canonical·OG·사이트맵·robots가 같은 도메인을 가리키게 함 */
export const SITE_URL = "https://globber.world";

export const SITE_NAME = "Globber";

/** 페이지별 값이 없을 때 쓰는 기본 제목과 설명 */
export const DEFAULT_TITLE = "Globber(글로버) - 지구본 위에서, 나의 여행을 한눈에!";
export const DEFAULT_DESCRIPTION = "지구본으로 완성하는 여행 기록 서비스";

/**
 * 링크 공유 미리보기에 쓰는 대표 이미지
 * public/assets/thumbnail.webp의 실제 크기와 같아야 함 (GLB-361)
 */
export const OG_IMAGE = {
  url: "/assets/thumbnail.webp",
  width: 1200,
  height: 630,
  type: "image/webp",
} as const;
