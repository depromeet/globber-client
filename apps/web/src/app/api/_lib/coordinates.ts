// Number()는 공백(0), 16진수("0x10"), 지수 표기("1e1")도 숫자로 바꾸므로 십진수 형식만 먼저 허용한다.
const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

/**
 * 쿼리의 lat·lng를 숫자로 읽고, 실제 좌표 범위 안에 있는지 확인합니다.
 * 값이 없거나 십진수 형식이 아니거나 범위를 벗어나면 null을 반환합니다.
 */
export const parseCoordinates = (searchParams: URLSearchParams): { lat: number; lng: number } | null => {
  const latParam = searchParams.get("lat")?.trim();
  const lngParam = searchParams.get("lng")?.trim();
  if (!latParam || !lngParam) return null;
  if (!DECIMAL_PATTERN.test(latParam) || !DECIMAL_PATTERN.test(lngParam)) return null;

  const lat = Number(latParam);
  const lng = Number(lngParam);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
};
