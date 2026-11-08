/**
 * 쿼리 파라미터에 담은 JSON 값을 읽습니다.
 * 값은 URLSearchParams가 한 번만 인코딩하므로 읽을 때는 그대로 JSON.parse 합니다.
 * 이전에는 encodeURIComponent 후 다시 인코딩한 값(%255B…)을 썼으므로, 그런 주소도 한 번 더 디코딩해 읽습니다.
 */
export const parseJsonQueryParam = (value: string | null | undefined): unknown => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    try {
      return JSON.parse(decodeURIComponent(value));
    } catch {
      return null;
    }
  }
};
