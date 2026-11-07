/**
 * 쿼리의 lat·lng를 숫자로 읽고, 실제 좌표 범위 안에 있는지 확인합니다.
 * 값이 없거나 범위를 벗어나면 null을 반환합니다.
 */
export const parseCoordinates = (searchParams: URLSearchParams): { lat: number; lng: number } | null => {
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  if (!latParam || !lngParam) return null;

  const lat = Number(latParam);
  const lng = Number(lngParam);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
};
