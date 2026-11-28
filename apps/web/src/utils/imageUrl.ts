import { env } from "@/config/env";

const ABSOLUTE_URL_PATTERN = /^(https?:|data:|blob:)/i;
const PROTOCOL_RELATIVE_PATTERN = /^\/\//;

/**
 * 서버가 준 이미지 주소를 화면에서 쓸 주소로 바꾼다 (GLB-211·397)
 * 서버는 전체 URL을 내려 주지만, 예전 응답처럼 S3 키만 오면 S3 주소를 앞에 붙인다
 * @param url - 서버가 준 전체 URL 또는 S3 키
 * @param fallbackKey - url이 없을 때 쓸 S3 키(예: photoCode)
 * @returns 이미지 주소, 둘 다 없으면 null
 */
export const resolveImageUrl = (url?: string | null, fallbackKey?: string | null): string | null => {
  const value = url?.trim() || fallbackKey?.trim();
  if (!value) return null;
  // 이미 주소인 값(http·https·data·blob)은 그대로, 프로토콜이 빠진 //host 형식은 https로 맞춘다
  if (ABSOLUTE_URL_PATTERN.test(value)) return value;
  if (PROTOCOL_RELATIVE_PATTERN.test(value)) return `https:${value}`;
  // S3 주소 환경 변수가 없으면 키를 상대 경로로 요청하는 깨진 주소가 되므로 이미지 없음으로 처리함 (GLB-319)
  if (!env.S3_BASE_URL) return null;
  return `${env.S3_BASE_URL}${value}`;
};
