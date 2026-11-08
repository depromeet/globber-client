import { EXTERNAL_URLS } from "@/constants/globeConfig";
import type { GeoJSONFeature } from "@/types/geography";

// 지구본을 다시 마운트해도(예: 리스트 보기 → 지구본) GeoJSON을 다시 받지 않도록 모듈 범위에 보관한다
let cachedFeatures: GeoJSONFeature[] | null = null;
let pendingRequest: Promise<GeoJSONFeature[]> | null = null;

export const getCachedWorldFeatures = (): GeoJSONFeature[] | null => cachedFeatures;

/**
 * 세계 지도 GeoJSON의 국가 feature 목록을 불러옵니다.
 * 한 번 받으면 캐시를 돌려주고, 요청 중이면 같은 요청을 함께 기다립니다. 실패하면 다음 호출에서 다시 요청합니다.
 */
export const loadWorldFeatures = (): Promise<GeoJSONFeature[]> => {
  if (cachedFeatures) return Promise.resolve(cachedFeatures);

  pendingRequest ??= fetch(EXTERNAL_URLS.WORLD_GEOJSON)
    .then(async response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const features: GeoJSONFeature[] = data?.features || [];
      cachedFeatures = features;
      return features;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
};
