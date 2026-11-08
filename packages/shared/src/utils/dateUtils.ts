/**
 * 날짜를 "YYYY.MM" 형식으로 포맷하는 함수
 * @param timestamp - ISO 날짜 문자열 또는 Date 객체
 * @returns 포맷된 날짜 문자열 또는 빈 문자열
 */
export const formatDate = (timestamp?: string | Date): string => {
  if (!timestamp) return "";

  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}.${month}`;
};

/**
 * 날짜를 "YYYYMM" 형식으로 변환하는 함수
 * @param timestamp - ISO 날짜 문자열 또는 Date 객체
 * @returns 변환된 날짜 문자열 또는 null
 */
export const toYearMonth = (timestamp?: string | Date | null): string | null => {
  if (!timestamp) return null;

  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}${month}`;
};

export const formatYearMonth = (yearMonth?: string | null): string | null => {
  if (!yearMonth || yearMonth.length !== 6) return null;
  return `${yearMonth.slice(0, 4)}.${yearMonth.slice(4, 6)}`;
};
