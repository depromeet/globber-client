/**
 * @file clusteringConstants.ts
 * @description Globe 줌 레벨 임계값 및 클러스터링 시스템 관련 모든 상수 정의
 * @responsibility 줌 상태 전환 기준값, 클러스터링 알고리즘 파라미터 중앙 관리
 *                 (Globe 렌더러 설정은 globeConfig.ts 참조)
 */

// ============================================
// 줌 레벨 임계값 (상태 관리 및 클러스터링 기준)
// ============================================

/**
 * Globe 줌 레벨 상수
 * 클러스터링, 렌더링, 상태 관리에서 사용되는 모든 줌 레벨 임계값
 */
export const ZOOM_LEVELS = {
  // 초기/기본 줌 레벨 (GLOBE_CONFIG.INITIAL_ALTITUDE, MAX_ZOOM 기준값)
  DEFAULT: 7,

  // 줌 상태 판단 기준
  ZOOM_THRESHOLD: 3, // 이보다 작으면 줌인된 상태 (기본 뷰 altitude ~4, 클러스터 줌 max 2.5 → 버퍼 확보)

  // 클러스터링 거리 계산용 줌 레벨
  CLUSTERING: {
    VERY_FAR: 2.0, // 매우 멀리서 볼 때 - 가까운 국가들만 클러스터링
    FAR: 1.5, // 멀리서 볼 때 - 중간 거리로 클러스터링
    MEDIUM: 1.0, // 중간 거리에서 볼 때 - 작은 거리로 클러스터링
    CLOSE: 0.5, // 가까이서 볼 때 - 매우 작은 거리로 클러스터링
    VERY_CLOSE: 0.3, // 매우 가까이서 볼 때 - 작은 거리로 클러스터링
    ZOOMED_IN: 0.2, // 줌인 상태에서도 같은 국가 클러스터링 유지
    DETAILED: 0.1, // 더 가까워도 같은 국가는 클러스터링
  },

  // 렌더링 관련 줌 레벨
  RENDERING: {
    CITY_LEVEL: 0.2, // 도시 단계 렌더링 기준
    CITY_TO_COUNTRY: 0.22, // 도시에서 국가로 전환 임계값
    COUNTRY_MIN: 0.3, // 국가 레벨 최소 줌
    COUNTRY_TO_ROOT: 0.45, // 국가에서 루트로 전환 임계값
    COUNTRY_MAX: 0.55, // 국가 레벨 최대 줌
  },

  // 기타 줌 관련 임계값
  THRESHOLDS: {
    ZOOM_DETECTION: 0.01, // 줌 변화 감지 임계값
    CITY_TO_COUNTRY_IN: 0.24, // 도시→나라 (줌인 시 진입 기준)
    CITY_TO_COUNTRY_OUT: 0.3, // 도시→나라 (줌아웃 시 이탈 기준)
    COUNTRY_TO_ROOT_IN: 0.55, // 나라→루트 (줌인 시 진입 기준)
    COUNTRY_TO_ROOT_OUT: 0.8, // 나라→루트 (줌아웃 시 이탈 기준)
    SMOOTH_ZOOM_JUMP: 0.1, // 부드러운 줌 점프 임계값
    SMOOTH_ZOOM_THRESHOLD: 0.02, // 부드러운 줌 변화 임계값
  },
} as const;

/**
 * 줌 레벨별 클러스터링 거리 매핑
 * 각 줌 레벨에서 적용할 클러스터링 반경 값
 */
export const CLUSTERING_DISTANCE_MAP = {
  [ZOOM_LEVELS.CLUSTERING.VERY_FAR]: 12,
  [ZOOM_LEVELS.CLUSTERING.FAR]: 8,
  [ZOOM_LEVELS.CLUSTERING.MEDIUM]: 5,
  [ZOOM_LEVELS.CLUSTERING.CLOSE]: 3,
  [ZOOM_LEVELS.CLUSTERING.VERY_CLOSE]: 2,
  [ZOOM_LEVELS.CLUSTERING.ZOOMED_IN]: 1.5,
  [ZOOM_LEVELS.CLUSTERING.DETAILED]: 1,
} as const;

// 타입 정의
export type ZoomLevel = typeof ZOOM_LEVELS;
export type ClusteringDistance = typeof CLUSTERING_DISTANCE_MAP;

// ============================================
// 회전 감지 및 처리
// ============================================

/**
 * 의미있는 회전으로 간주할 최소 거리 (도 단위)
 * 이 값보다 큰 회전이 발생하면 도시 모드에서 국가 모드로 자동 복귀
 */
export const ROTATION_THRESHOLD = 10;

/**
 * 회전 감지 후 자동 클러스터링까지 지연 시간 (ms)
 */
export const AUTO_CLUSTER_DELAY = 0;

/**
 * 회전 업데이트 임계값 (도 단위)
 * 이 값보다 작은 회전은 무시하여 불필요한 업데이트 방지
 */
export const ROTATION_UPDATE_THRESHOLD = 5;

/**
 * 회전 부드러움 계수 (0-1)
 * 값이 작을수록 더 부드러운 회전 애니메이션
 */
export const ROTATION_SMOOTHING_FACTOR = 0.3;

// ============================================
// 거리 및 위치 계산
// ============================================

/**
 * 지리적 거리 임계값 (km 단위)
 * 이 거리 이내의 국가들을 같은 서브클러스터로 그룹핑
 */
export const GEO_DISTANCE_THRESHOLD = 3000;

/**
 * 지구 반지름 (km)
 * 하버신 공식 계산에 사용
 */
export const EARTH_RADIUS_KM = 6371;

// ============================================
// 버블 렌더링 크기
// ============================================

/**
 * 국기 이모지 너비 (px)
 */
export const BUBBLE_FLAG_WIDTH = 24;

/**
 * 버블 요소 간 간격 (px)
 */
export const BUBBLE_GAP = 5;

/**
 * 대륙 클러스터 폰트 크기 (px)
 */
export const CONTINENT_CLUSTER_FONT_SIZE = 16;

/**
 * 대륙 클러스터 패딩 (px)
 */
export const CONTINENT_CLUSTER_PADDING = 16;

/**
 * 국가 클러스터 폰트 크기 (px)
 */
export const COUNTRY_CLUSTER_FONT_SIZE = 15;

/**
 * 국가 클러스터 패딩 (px)
 */
export const COUNTRY_CLUSTER_PADDING = 12;

/**
 * 도시 클러스터 패딩 (px)
 */
export const CITY_CLUSTER_PADDING = 6;

/**
 * 도시 개수 배지 너비 (px)
 */
export const COUNT_BADGE_WIDTH = 20;

// ============================================
// 클러스터링 계산
// ============================================

/**
 * 버블 유효 너비 비율
 * 실제 버블 너비에 곱해져서 겹침 판단에 사용
 */
export const EFFECTIVE_WIDTH_RATIO = 0.8;

/**
 * 겹침 판단 임계값 비율
 * 두 버블 사이 거리가 이 비율보다 작으면 겹친 것으로 판단
 */
export const OVERLAP_THRESHOLD_RATIO = 0.4;

// ============================================
// 모드 전환
// ============================================

/**
 * 대륙 모드로 전환되는 줌 레벨 배수
 * ZOOM_LEVELS.DEFAULT * 이 값 이상이면 대륙 모드로 전환
 */
export const CONTINENT_MODE_ZOOM_MULTIPLIER = 1.5;

// ============================================
// 애니메이션
// ============================================

/**
 * 줌 애니메이션 지속 시간 (ms)
 * 클러스터 클릭 시 자동 줌인 애니메이션에 사용
 */
export const ZOOM_ANIMATION_DURATION = 3000;
