import { z } from "zod";

// 프로필 편집 폼 검증 상수
export const PROFILE_VALIDATION = {
  MAX_NICKNAME_LENGTH: 20,
  MAX_IMAGE_SIZE_MB: 5,
  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024,
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"],
} as const;

const isAllowedImageType = (type: string): type is (typeof PROFILE_VALIDATION.ALLOWED_IMAGE_TYPES)[number] =>
  PROFILE_VALIDATION.ALLOWED_IMAGE_TYPES.includes(type as (typeof PROFILE_VALIDATION.ALLOWED_IMAGE_TYPES)[number]);

// 이모지 패턴 (Emoji_Component는 0-9, #, * 등 일반 문자를 포함하므로 통째로 쓰지 않는다)
// 변형 선택자(U+FE0F), 키캡 결합 문자(U+20E3), 태그 문자는 이모지 시퀀스의 일부이므로 함께 처리한다.
// ZWJ(U+200D)는 일부 언어의 일반 문자에도 쓰이므로 감지에는 쓰지 않고, 제거할 때 이모지에 붙은 것만 함께 지운다.
const EMOJI_PATTERN =
  /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Modifier_Base}|[\uFE0F\u20E3\u{E0020}-\u{E007F}]/u.source;

export const containsEmoji = (value: string) => new RegExp(EMOJI_PATTERN, "u").test(value);
export const removeEmoji = (value: string) =>
  value.replace(new RegExp(`\\u200D?(?:${EMOJI_PATTERN})\\u200D?`, "gu"), "");

// 닉네임 스키마
// unchangedNickname: 이모지 차단 이전에 설정된 기존 닉네임. 변경하지 않은 경우 이모지 검증을 건너뛴다.
const createNicknameSchema = (unchangedNickname?: string) =>
  z
    .string()
    .min(1, { message: "닉네임을 입력해주세요." })
    .max(PROFILE_VALIDATION.MAX_NICKNAME_LENGTH, {
      message: `닉네임은 ${PROFILE_VALIDATION.MAX_NICKNAME_LENGTH}자 이하여야 합니다.`,
    })
    .refine(value => value === unchangedNickname || !containsEmoji(value), {
      message: "이모지는 사용할 수 없습니다.",
    });

export const nicknameSchema = createNicknameSchema();

// 이미지 파일 스키마 (클라이언트 사이드 검증용)
export const imageFileSchema = z
  .custom<File>(val => val instanceof File, {
    message: "유효한 파일이 아닙니다.",
  })
  .refine(({ size }) => size <= PROFILE_VALIDATION.MAX_IMAGE_SIZE_BYTES, {
    message: `이미지 크기는 ${PROFILE_VALIDATION.MAX_IMAGE_SIZE_MB}MB 이하여야 합니다.`,
  })
  .refine(({ type }) => isAllowedImageType(type), {
    message: "지원되는 이미지 형식: JPEG, PNG, GIF, WebP, HEIC, HEIF",
  })
  .optional();

// 프로필 편집 폼 스키마
export const createEditProfileSchema = (initialNickname?: string) =>
  z.object({
    nickname: createNicknameSchema(initialNickname),
    imageFile: imageFileSchema,
  });

export const editProfileSchema = createEditProfileSchema();

export type EditProfileFormData = z.infer<typeof editProfileSchema>;

// 파일 검증 헬퍼 함수 (FileReader 사용 전 빠른 검증)
export const validateImageFile = ({ type, size }: File): { isValid: boolean; error?: string } => {
  if (size > PROFILE_VALIDATION.MAX_IMAGE_SIZE_BYTES)
    return {
      isValid: false,
      error: `이미지 크기는 ${PROFILE_VALIDATION.MAX_IMAGE_SIZE_MB}MB 이하여야 합니다.`,
    };

  if (!isAllowedImageType(type))
    return {
      isValid: false,
      error: "이미지 파일만 업로드 가능합니다.",
    };

  return { isValid: true };
};
