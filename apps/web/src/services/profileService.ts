import type {
  ProfileData,
  ProfileResponse,
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

/**
 * S3에 업로드하기 위한 Presigned URL을 요청합니다.
 *
 * @param uploadData - 업로드 요청 데이터 (uploadType, resourceId, fileName, contentType)
 * @param token - 선택사항. 인증 토큰. 클라이언트 컴포넌트에서는 제공되지 않으면 쿠키에서 가져옵니다.
 * @returns presignedUrl과 s3Key를 포함한 응답
 * @throws 인증 정보가 없거나 API 요청이 실패할 경우
 *
 * @example
 * const { presignedUrl, s3Key } = await getS3UploadUrl({
 *   uploadType: "PROFILE",
 *   resourceId: 123,
 *   fileName: "profile.jpg",
 *   contentType: "image/jpeg"
 * });
 */
export const getS3UploadUrl = async (
  uploadData: S3UploadUrlParams,
  token?: string
): Promise<{ presignedUrl: string; s3Key: string }> => {
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
 * 프로필을 업데이트합니다.
 * - 이미지가 있으면: S3 업로드 → /api/v1/profiles/me/image → /api/v1/profiles/me
 * - 이미지가 없으면: /api/v1/profiles/me만 호출
 *
 * @param nickname - 변경할 닉네임
 * @param memberId - 회원 ID (이미지 업로드 시 필요)
 * @param imageFile - 업로드할 이미지 파일 (선택사항)
 * @param token - 선택사항. 인증 토큰
 * @returns 업데이트된 프로필 정보
 * @throws 업로드 또는 업데이트 실패 시
 *
 * @example
 * // 이미지와 닉네임을 함께 업로드
 * const updatedProfile = await uploadAndUpdateProfile("새로운닉네임", 123, imageFile);
 *
 * @example
 * // 닉네임만 업데이트
 * const updatedProfile = await uploadAndUpdateProfile("새로운닉네임", 123);
 */
export const uploadAndUpdateProfile = async (
  nickname: string,
  memberId: number,
  imageFile?: File,
  token?: string
): Promise<ProfileData> => {
  try {
    const authToken = getValidatedAuthToken(token);

    // 이미지가 있으면 S3 업로드 후 이미지 정보 업데이트
    if (imageFile) {
      const { presignedUrl, s3Key } = await getS3UploadUrl(
        {
          uploadType: "PROFILE",
          resourceId: memberId,
          fileName: imageFile.name,
          contentType: imageFile.type,
        },
        authToken
      );

      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": imageFile.type,
        },
        body: imageFile,
      });

      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed with status ${uploadResponse.status}`);
      }

      // 이미지 정보 업데이트
      await apiPatch<ProfileResponse>("/api/v1/profiles/me/image", { s3Key }, authToken);
    }

    // 닉네임 업데이트
    const data = await apiPatch<ProfileResponse>("/api/v1/profiles/me", { nickname }, authToken);
    return data.data;
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
