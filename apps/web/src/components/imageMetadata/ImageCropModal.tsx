"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Area } from "react-easy-crop";
import Cropper from "react-easy-crop";

import { sendGAEvent } from "@next/third-parties/google";

import { Header } from "../common/Header";

type ImageCropModalProps = {
  image: string;
  onClose: () => void;
  onSave: (croppedImage: string) => void;
  photoIndex?: number;
};

export const ImageCropModal = ({ image, onClose, onSave, photoIndex = 0 }: ImageCropModalProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);

  const interactionCountRef = useRef(0);
  const interactionDurationRef = useRef(0);
  const gestureStartTimeRef = useRef<number | null>(null);
  const zoomChangedInGestureRef = useRef(false);
  const gestureEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    sendGAEvent("event", "record_crop_view", {
      flow: "editor",
      screen: "record_edit_crop",
      photo_index: photoIndex,
    });
  }, [photoIndex]);

  useEffect(() => {
    return () => {
      if (gestureEndTimerRef.current) {
        clearTimeout(gestureEndTimerRef.current);
      }
    };
  }, []);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let blobUrlToCleanup: string | null = null;

    const loadImage = async () => {
      try {
        const blobUrl = await fetchImageAsBlob(image);
        blobUrlToCleanup = blobUrl;
        if (!cancelled) {
          setImageBlobUrl(blobUrl);
        }
      } catch {
        if (!cancelled) {
          alert("이미지 로드에 실패했습니다.");
          onClose();
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
      if (blobUrlToCleanup) {
        URL.revokeObjectURL(blobUrlToCleanup);
      }
    };
    // 부모 컴포넌트 렌더링 시 onClose 참조값이 변경되어 이펙트가 무의미하게 재실행되고,
    // 이로 인해 만들어둔 프리뷰용 Blob URL이 조기 해제(cleanup)되는 버그를 방지하기 위해 의존성 배열에서 제외합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  const handleGestureActivity = (isZoom: boolean) => {
    const now = Date.now();

    if (gestureStartTimeRef.current === null) {
      gestureStartTimeRef.current = now;
      zoomChangedInGestureRef.current = false;
    }

    if (isZoom) {
      zoomChangedInGestureRef.current = true;
    }

    if (gestureEndTimerRef.current) {
      clearTimeout(gestureEndTimerRef.current);
    }

    gestureEndTimerRef.current = setTimeout(() => {
      const duration = Date.now() - (gestureStartTimeRef.current ?? now);
      const gestureType = zoomChangedInGestureRef.current ? "zoom" : "drag";

      interactionCountRef.current += 1;
      interactionDurationRef.current += duration;

      sendGAEvent("event", "record_crop_interaction", {
        flow: "editor",
        screen: "record_edit_crop",
        click_code:
          gestureType === "drag" ? "editor.record.edit.crop.gesture.move" : "editor.record.edit.crop.gesture.zoom",
        photo_index: photoIndex,
        gesture_type: gestureType,
        interaction_count: interactionCountRef.current,
        interaction_duration: interactionDurationRef.current,
      });

      gestureStartTimeRef.current = null;
      gestureEndTimerRef.current = null;
    }, 300);
  };

  const handleCropChange = (newCrop: { x: number; y: number }) => {
    setCrop(newCrop);
    handleGestureActivity(false);
  };

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    handleGestureActivity(true);
  };

  const createCroppedImage = async () => {
    if (!croppedAreaPixels || !imageBlobUrl) return;

    const modified = interactionCountRef.current > 0;
    sendGAEvent("event", "record_crop_complete", {
      flow: "editor",
      screen: "record_edit_crop",
      click_code: "editor.record.edit.crop.header.complete",
      interaction_count: interactionCountRef.current,
      modified,
    });

    try {
      const croppedImage = await getCroppedImg(imageBlobUrl, croppedAreaPixels);
      onSave(croppedImage);
      onClose();
    } catch (error) {
      alert("이미지 크롭에 실패했습니다. 다시 시도해주세요.");
      throw error;
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!imageBlobUrl) {
    if (!mounted) return null;
    return createPortal(
      <div className="image-crop-modal fixed inset-0 z-[100] bg-black flex items-center justify-center">
        <div className="text-white text-sm">이미지 로딩 중...</div>
      </div>,
      document.body
    );
  }

  if (!mounted) return null;

  return createPortal(
    <div className="image-crop-modal fixed inset-0 z-[100] bg-black">
      <div className="max-w-md mx-auto w-full h-full relative">
        {/* Header - Absolute positioned */}
        <div className="absolute top-0 left-0 right-0 z-10">
          <Header
            variant="dark"
            leftIcon="close"
            onLeftClick={onClose}
            rightButtonTitle="완료"
            rightButtonVariant="white"
            onRightClick={createCroppedImage}
          />
        </div>

        {/* Crop Area - Full screen */}
        <div className="relative w-full h-full pb-[env(safe-area-inset-bottom)]">
          <Cropper
            image={imageBlobUrl}
            crop={crop}
            zoom={zoom}
            aspect={9 / 16}
            onCropChange={handleCropChange}
            onCropComplete={onCropComplete}
            onZoomChange={handleZoomChange}
            style={{
              containerStyle: {
                width: "100%",
                height: "100%",
                backgroundColor: "#000",
              },
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

/**
 * S3 이미지를 Blob URL로 변환합니다 (CORS 우회).
 *
 * @param {string} url - 원본 이미지 URL
 * @returns {Promise<string>} Blob URL
 */
const fetchImageAsBlob = async (url: string): Promise<string> => {
  try {
    // S3 등 외부 요소를 fetch할 때 브라우저 디스크 캐시(<img> 태그가 로드한 CORS 헤더 없는 캐시)를
    // 사용할 경우 CORS 에러가 발생할 수 있으므로, 캐시 우회를 위해 파라미터를 추가합니다.
    // 단, URL이 이미 브라우저 내부의 blob: 형태인 경우 파라미터를 추가하면 깨지므로 분기 처리합니다.
    let fetchUrl = url;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const cacheUrl = new URL(url);
      cacheUrl.searchParams.set("t", Date.now().toString());
      fetchUrl = cacheUrl.toString();
    }

    const response = await fetch(fetchUrl, {
      mode: "cors",
      credentials: "include",
    });

    if (response.ok) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch (error) {
    // CORS 또는 네트워크 에러 발생 시 Next.js Image Proxy로 fallback
    console.warn("Direct S3 fetch failed, falling back to Next.js proxy:", error);
  }

  // Fallback: Next.js Image Proxy 사용 (3840은 부하가 커 1920으로 낮춤)
  const proxyUrl = `/_next/image?url=${encodeURIComponent(url)}&w=1920&q=95`;
  const proxyResponse = await fetch(proxyUrl);

  if (!proxyResponse.ok) {
    throw new Error("Failed to fetch image via proxy");
  }

  const blob = await proxyResponse.blob();
  return URL.createObjectURL(blob);
};

/**
 * 이미지를 크롭하여 새로운 이미지를 생성합니다.
 *
 * @param {string} imageBlobUrl - Blob URL 형태의 이미지 URL
 * @param {Area} pixelCrop - 크롭 영역 정보
 * @returns {Promise<string>} 크롭된 이미지의 Blob URL
 */
const getCroppedImg = async (imageBlobUrl: string, pixelCrop: Area): Promise<string> => {
  const image = await createImage(imageBlobUrl);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas context is not available");
  }

  const ASPECT_RATIO = 9 / 16;
  const { x, y, width, height } = pixelCrop;

  const canvasWidth = Math.round(width);
  const canvasHeight = Math.round(canvasWidth / ASPECT_RATIO);

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.drawImage(image, x, y, width, height, 0, 0, canvasWidth, canvasHeight);

  const OUTPUT_MIME_TYPE = "image/jpeg";
  const OUTPUT_QUALITY = 0.95;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        const fileUrl = URL.createObjectURL(blob);
        resolve(fileUrl);
      },
      OUTPUT_MIME_TYPE,
      OUTPUT_QUALITY
    );
  });
};

/**
 * 이미지 URL로부터 HTMLImageElement를 생성합니다.
 *
 * @param {string} url - 이미지 URL (Blob URL)
 * @returns {Promise<HTMLImageElement>} 로드된 이미지 엘리먼트
 */
const createImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", error => reject(error));
    image.src = url;
  });
};
