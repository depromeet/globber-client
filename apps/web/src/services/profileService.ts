import type {
  ProfileData,
  ProfileResponse,
  S3UploadUrlData,
  S3UploadUrlParams,
  S3UploadUrlResponse,
} from "@globber/shared/types/member";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { getValidatedAuthToken } from "@/utils/cookies";

/**
 * 현재 로그인한 사용자의 프로필 정보를 조회합니다.
 *
 * @param token - 선택사항. 인증 토큰. 클라이언트 컴포넌트에서는 제공되지 않으면 쿠키에서 가져옵니다.
 * @returns 프로필 정보 객체
 * @throws 인증 정보가 없거나 API 요청이 실패할 경우
 *
 * @example
 * // 클라이언트 컴포넌트에서 (자동으로 쿠키에서 토큰 가져옴)
 * const profile = await getMyProfile();
 * console.log(profile.nickname); // "이승현"
 *
 * @example
 * // 서버 컴포넌트에서 토큰을 명시적으로 전달하는 경우
 * const token = await getServerAuthToken();
 * const profile = await getMyProfile(token);
 */
export const getMyProfile = async (token?: string): Promise<ProfileData> => {
  try {
    const authToken = getValidatedAuthToken(token);

    const data = await apiGet<ProfileResponse>("/api/v1/profiles/me", {}, authToken);
    return data.data;
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    throw error;
  }
};

// 서버가 허용하는 업로드 형식과, S3 키 확장자로 쓸 값 (백엔드가 fileName의 확장자로 키를 만든다)
const UPLOAD_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

/**
 * 업로드 요청에 보낼 파일명을 실제 형식에 맞춥니다.
 * 확장자가 없거나 형식과 다르면(예: 변환 전 이름 .heic) 형식에 맞는 확장자로 바꿉니다.
 */
export const toUploadFileName = (file: File): string => {
  const extension = UPLOAD_EXTENSION_BY_TYPE[file.type];
  if (!extension) return file.name;

  const current = file.name.match(/\.[^./]+$/)?.[0]?.toLowerCase();
  if (current === extension || (extension === ".jpg" && current === ".jpeg")) return file.name;

  const base = current ? file.name.slice(0, -current.length) : file.name;
  return `${base || "image"}${extension}`;
};

/**
 * Presigned URL로 파일을 S3에 올립니다.
 * 서버가 준 uploadHeaders를 그대로 보내고, 응답에 없으면(이전 버전 백엔드) Content-Type만 보냅니다.
 */
export const putToPresignedUrl = async (
  presignedUrl: string,
  file: File,
  uploadHeaders?: Record<string, string>
): Promise<void> => {
  const uploadResponse = await fetch(presignedUrl, {
    method: "PUT",
    headers: uploadHeaders ?? { "Content-Type": file.type },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`S3 upload failed with status ${uploadResponse.status}`);
  }
};

/**
 * S3에 업로드하기 위한 Presigned URL을 요청합니다.
 *
 * @param uploadData - 업로드 요청 데이터 (uploadType, fileName, contentType). 저장 경로는 서버가 토큰의 회원 기준으로 정한다
 * @param token - 선택사항. 인증 토큰. 클라이언트 컴포넌트에서는 제공되지 않으면 쿠키에서 가져옵니다.
 * @returns presignedUrl과 s3Key를 포함한 응답
 * @throws 인증 정보가 없거나 API 요청이 실패할 경우
 *
 * @example
 * const { presignedUrl, s3Key } = await getS3UploadUrl({
 *   uploadType: "PROFILE",
 *   fileName: "profile.jpg",
 *   contentType: "image/jpeg"
 * });
 */
export const getS3UploadUrl = async (uploadData: S3UploadUrlParams, token?: string): Promise<S3UploadUrlData> => {
  try {
    const authToken = getValidatedAuthToken(token);

    const response = await apiPost<S3UploadUrlResponse>("/api/v1/s3/upload-url", uploadData, authToken);
    return response.data;
  } catch (error) {
    console.error("Failed to get S3 upload URL:", error);
    throw error;
  }
};

/**
 * 프로필 이미지는 저장됐지만 이어진 닉네임 저장이 실패했을 때 던집니다.
 * 서버에는 새 이미지가 반영된 상태이므로, 호출부는 프로필을 다시 조회하고 닉네임만 다시 시도하게 합니다.
 */
export class ProfileNicknameUpdateError extends Error {
  constructor(public nicknameError: unknown) {
    super("프로필 이미지는 저장됐지만 닉네임 저장에 실패했습니다.");
    this.name = "ProfileNicknameUpdateError";
  }
}

/**
 * 프로필을 업데이트합니다.
 * - 이미지가 있으면: S3 업로드 → /api/v1/profiles/me/image → /api/v1/profiles/me
 * - 이미지가 없으면: /api/v1/profiles/me만 호출
 *
 * @param nickname - 변경할 닉네임
 * @param imageFile - 업로드할 이미지 파일 (선택사항)
 * @param token - 선택사항. 인증 토큰
 * @returns 업데이트된 프로필 정보
 * @throws 업로드 또는 업데이트 실패 시. 이미지 저장 후 닉네임 저장만 실패하면 ProfileNicknameUpdateError
 *
 * @example
 * // 이미지와 닉네임을 함께 업로드
 * const updatedProfile = await uploadAndUpdateProfile("새로운닉네임", imageFile);
 *
 * @example
 * // 닉네임만 업데이트
 * const updatedProfile = await uploadAndUpdateProfile("새로운닉네임");
 */
export const uploadAndUpdateProfile = async (
  nickname: string,
  imageFile?: File,
  token?: string
): Promise<ProfileData> => {
  try {
    const authToken = getValidatedAuthToken(token);

    // 이미지가 있으면 S3 업로드 후 이미지 정보 업데이트
    if (imageFile) {
      const { presignedUrl, s3Key, uploadHeaders } = await getS3UploadUrl(
        {
          uploadType: "PROFILE",
          fileName: toUploadFileName(imageFile),
          contentType: imageFile.type,
        },
        authToken
      );

      await putToPresignedUrl(presignedUrl, imageFile, uploadHeaders);

      // 이미지 정보 업데이트
      await apiPatch<ProfileResponse>("/api/v1/profiles/me/image", { s3Key }, authToken);
    }

    // 닉네임 업데이트
    try {
      const data = await apiPatch<ProfileResponse>("/api/v1/profiles/me", { nickname }, authToken);
      return data.data;
    } catch (error) {
      if (imageFile) throw new ProfileNicknameUpdateError(error);
      throw error;
    }
  } catch (error) {
    console.error("Failed to upload and update profile:", error);
    throw error;
  }
};

/**
 * 회원 계정을 삭제합니다. (회원탈퇴)
 *
 * @param token - 선택사항. 인증 토큰. 클라이언트 컴포넌트에서는 제공되지 않으면 쿠키에서 가져옵니다.
 * @returns 회원 삭제 성공 응답
 * @throws 회원 삭제 실패 시 에러 발생
 *
 * @example
 * // 클라이언트 컴포넌트에서 사용
 * await withdrawMember();
 */
export const withdrawMember = async (token?: string): Promise<void> => {
  try {
    const authToken = getValidatedAuthToken(token);
    await apiDelete("/withdraw", undefined, authToken);
  } catch (error) {
    console.error("Failed to withdraw member:", error);
    throw error;
  }
};
