"use client";

import Image from "next/image";

import { DEFAULT_PROFILE_IMAGE } from "@/constants/image";
import { useImageLoadError } from "@/hooks/useImageLoadError";

type RecordUserInfoProps = {
  userName: string;
  userAvatar?: string;
  description?: string;
};

export const RecordUserInfo = ({ userName, userAvatar, description }: RecordUserInfoProps) => {
  const { hasError: hasAvatarError, handleError: handleAvatarError } = useImageLoadError(userAvatar);

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* 사용자 정보 */}
      <div className="flex items-center gap-2">
        {/* 아바타 */}
        <div className="relative w-[34px] h-[34px] rounded-full overflow-hidden shrink-0">
          {userAvatar ? (
            <Image
              src={hasAvatarError ? DEFAULT_PROFILE_IMAGE : userAvatar}
              alt={userName}
              fill
              className="object-cover"
              onError={handleAvatarError}
            />
          ) : (
            <div className="w-full h-full bg-surface-thirdly flex items-center justify-center text-text-secondary text-sm">
              {userName.charAt(0) || "?"}
            </div>
          )}
        </div>

        {/* 사용자 이름 */}
        <p className="font-bold text-base text-text-primary">{userName}</p>
      </div>

      {/* 설명 */}
      {description && <p className="text-sm font-medium text-text-primary leading-relaxed">{description}</p>}
    </div>
  );
};
