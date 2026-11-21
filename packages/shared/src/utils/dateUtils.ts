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

const API_YEAR_MONTH_PATTERN = /^(\d{4})-?(\d{2})$/;

/**
 * 서버의 촬영 월("YYYY-MM")을 화면에서 쓰는 "YYYYMM"으로 바꾼다 (GLB-212·379)
 * @param value - 서버 응답의 takenMonth. 예전 형식 "YYYYMM"도 받는다
 * @returns "YYYYMM" 또는 형식이 맞지 않으면 null
 */
export const fromApiYearMonth = (value?: string | null): string | null => {
  const match = value ? API_YEAR_MONTH_PATTERN.exec(value.trim()) : null;
  return match ? `${match[1]}${match[2]}` : null;
};

/**
 * 화면에서 쓰는 "YYYYMM"을 서버 요청 형식 "YYYY-MM"으로 바꾼다 (GLB-212·379)
 * @param yearMonth - "YYYYMM" 문자열
 * @returns "YYYY-MM" 또는 형식이 맞지 않으면 null
 */
export const toApiYearMonth = (yearMonth?: string | null): string | null => {
  const digits = fromApiYearMonth(yearMonth);
  return digits ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}` : null;
};

export const formatYearMonth = (yearMonth?: string | null): string | null => {
  if (!yearMonth || yearMonth.length !== 6) return null;
  return `${yearMonth.slice(0, 4)}.${yearMonth.slice(4, 6)}`;
};
