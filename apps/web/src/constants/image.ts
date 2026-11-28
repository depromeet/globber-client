/** 프로필 사진이 없거나 불러오지 못했을 때 보여 주는 기본 이미지 */
export const DEFAULT_PROFILE_IMAGE = "/assets/default-profile.png";

/** 사진을 불러오지 못했을 때 보여 주는 안내 문구 */
export const IMAGE_LOAD_ERROR_MESSAGE = "사진을 불러오지 못했어요";

/** 서버가 받는 업로드 형식 (백엔드 GLB-157·215·323). HEIC는 업로드 전에 JPEG로 바꾼다 */
export const UPLOAD_IMAGE_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/** 서버가 받는 사진 한 장의 최대 크기 (백엔드 ImageUploadPolicy.MAX_SIZE_BYTES와 같다) */
export const UPLOAD_IMAGE_MAX_SIZE_MB = 10;
export const UPLOAD_IMAGE_MAX_SIZE_BYTES = UPLOAD_IMAGE_MAX_SIZE_MB * 1024 * 1024;

/**
 * HEIC 원본의 최대 크기
 * 변환 결과는 10MB 검사를 따로 받지만, 아주 큰 원본은 변환 자체가 메모리를 많이 써서 변환 전에 거절함 (GLB-256)
 */
export const HEIC_SOURCE_MAX_SIZE_MB = 30;
export const HEIC_SOURCE_MAX_SIZE_BYTES = HEIC_SOURCE_MAX_SIZE_MB * 1024 * 1024;

/** HEIC 원본이 최대 크기를 넘을 때 보여 주는 안내 문구 */
export const OVERSIZED_HEIC_MESSAGE = `HEIC 사진은 원본 ${HEIC_SOURCE_MAX_SIZE_MB}MB 이하만 올릴 수 있어요.`;

/** 최대 크기를 넘는 사진을 골랐을 때 보여 주는 안내 문구 */
export const OVERSIZED_IMAGE_MESSAGE = `${UPLOAD_IMAGE_MAX_SIZE_MB}MB 이하 사진만 올릴 수 있어요.`;

/** 지원하지 않는 형식의 사진을 골랐을 때 보여 주는 안내 문구 */
export const UNSUPPORTED_IMAGE_TYPE_MESSAGE = "JPG, PNG, WEBP, AVIF, HEIC 사진만 올릴 수 있어요.";

/** 사진 업로드에 실패했을 때 보여 주는 안내 문구 */
export const IMAGE_UPLOAD_ERROR_MESSAGE = "사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.";
