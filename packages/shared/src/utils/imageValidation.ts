/**
 * 이미지 URL의 유효성을 검증합니다.
 *
 * @param {string} url - 검증할 이미지 URL
 * @returns {boolean} URL이 유효하면 true, 그렇지 않으면 false
 *
 * @example
 * isValidImageUrl("https://example.com/image.jpg"); // true
 * isValidImageUrl("/images/photo.png"); // true
 * isValidImageUrl("string"); // false
 * isValidImageUrl(""); // false
 */
export const isValidImageUrl = (url: string): boolean => {
  // 빈 문자열이나 "string" 같은 placeholder 제거
  if (!url || url === "string" || url.length < 5) return false;

  // URL 형식 검증 (http, https, 또는 /로 시작)
  return url.startsWith("http") || url.startsWith("/");
};

/**
 * 이미지 URL 배열을 필터링하여 유효한 URL만 반환합니다.
 *
 * @param {string[]} urls - 필터링할 이미지 URL 배열
 * @returns {string[]} 유효한 이미지 URL만 포함된 배열
 *
 * @example
 * filterValidImageUrls(["https://example.com/1.jpg", "string", "/image.png"]);
 * // ["https://example.com/1.jpg", "/image.png"]
 */
export const filterValidImageUrls = (urls: string[]): string[] => {
  return urls.filter(url => {
    if (!url || typeof url !== "string") return false;
    return isValidImageUrl(url);
  });
};
