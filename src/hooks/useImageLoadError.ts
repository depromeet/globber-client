"use client";

import { useCallback, useState } from "react";

/**
 * 이미지 로드 실패 여부를 추적합니다.
 * 실패한 src를 기억하므로 src가 바뀌면 자동으로 다시 로드를 시도합니다.
 *
 * @param {string} [src] - 로드할 이미지 URL
 * @returns {{ hasError: boolean, handleError: () => void }} 실패 여부와 onError 핸들러
 *
 * @example
 * const { hasError, handleError } = useImageLoadError(src);
 * return hasError ? <ImageFallback /> : <Image src={src} onError={handleError} />;
 */
export const useImageLoadError = (src?: string | null) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const hasError = Boolean(src) && failedSrc === src;

  const handleError = useCallback(() => {
    setFailedSrc(src ?? null);
  }, [src]);

  return { hasError, handleError };
};
