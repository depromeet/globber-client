"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Area } from "react-easy-crop";
import Cropper from "react-easy-crop";

import { logger } from "@globber/shared/utils/logger";
import { sendGAEvent } from "@next/third-parties/google";

import { toast } from "@/components/common/GlobalToast";

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
  const [isCropping, setIsCropping] = useState(false);

  // 상태 갱신 전에 들어온 두 번째 클릭까지 막기 위해 ref로도 잠금 (GLB-185)
  const isCroppingRef = useRef(false);
  const interactionCountRef = useRef(0);
  const interactionDurationRef = useRef(0);
  const gestureStartTimeRef = useRef<number | null>(null);
  const zoomChangedInGestureRef = useRef(false);
  const gestureEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

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
        // 불러오는 동안 모달이 닫혔으면 정리 함수가 이미 지나갔으므로 여기서 해제한다
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        blobUrlToCleanup = blobUrl;
        setImageBlobUrl(blobUrl);
      } catch {
        if (!cancelled) {
          toast.error("사진을 불러오는 데 실패했습니다.");
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
    if (!croppedAreaPixels || !imageBlobUrl || isCroppingRef.current) return;
    isCroppingRef.current = true;
    setIsCropping(true);

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
      // 실패하면 다시 시도할 수 있도록 잠금을 풂
      isCroppingRef.current = false;
      setIsCropping(false);
      toast.error("사진 자르기에 실패했습니다. 다시 시도해주세요.");
      throw error;
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 작성 화면은 핀치 확대를 허용하지만, 모달 위 핀치는 자르기 확대와 겹치므로 모달 영역에서만 페이지 확대를 막는다 (GLB-326)
  // 크롭 영역은 react-easy-crop이 직접 막고, 헤더 등 나머지 영역의 두 손가락 터치를 여기서 막는다
  // viewport를 동적으로 바꾸면 iOS가 확대 상태를 되돌리지 못하는 경우가 있어 이벤트로 처리한다
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const preventPinchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    // iOS Safari는 핀치 확대를 gesture 이벤트로도 처리한다
    const preventGestureZoom = (e: Event) => e.preventDefault();

    modal.addEventListener("touchstart", preventPinchZoom, { passive: false });
    modal.addEventListener("touchmove", preventPinchZoom, { passive: false });
    modal.addEventListener("gesturestart", preventGestureZoom);

    return () => {
      modal.removeEventListener("touchstart", preventPinchZoom);
      modal.removeEventListener("touchmove", preventPinchZoom);
      modal.removeEventListener("gesturestart", preventGestureZoom);
    };
  }, [mounted, imageBlobUrl]);

  if (!imageBlobUrl) {
    if (!mounted) return null;
    return createPortal(
      <div
        ref={modalRef}
        className="image-crop-modal fixed inset-0 z-[100] bg-black touch-none flex items-center justify-center"
      >
        <div className="text-white text-sm">사진 불러오는 중...</div>
      </div>,
      document.body
    );
  }

  if (!mounted) return null;

  return createPortal(
    <div ref={modalRef} className="image-crop-modal fixed inset-0 z-[100] bg-black touch-none">
      <div className="max-w-md mx-auto w-full h-full relative">
        {/* 헤더 - 절대 위치 */}
        <div className="absolute top-0 left-0 right-0 z-10">
          <Header
            variant="dark"
            leftIcon="close"
            onLeftClick={onClose}
            rightButtonTitle="완료"
            rightButtonVariant="white"
            rightButtonDisabled={isCropping}
            onRightClick={createCroppedImage}
          />
        </div>

        {/* 크롭 영역 - 전체 화면 */}
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
                backgroundColor: "var(--color-surface-primary)",
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
 * 원본 화질 그대로 이미지를 Blob URL로 변환합니다 (CORS 우회).
 * S3 직접 요청이 CORS로 실패하면 같은 출처 프록시(/api/image-proxy)로 원본을 받아옵니다.
 *
 * @param {string} url - 원본 이미지 URL
 * @returns {Promise<string>} Blob URL
 */
const fetchImageAsBlob = async (url: string): Promise<string> => {
  // 새로 고른 사진(blob:)은 CORS와 상관없고, 파라미터를 붙이면 주소가 깨지므로 그대로 읽는다
  const isRemote = url.startsWith("http://") || url.startsWith("https://");
  if (!isRemote) {
    const response = await fetch(url);
    return URL.createObjectURL(await response.blob());
  }

  try {
    // S3 등 외부 요소를 fetch할 때 브라우저 디스크 캐시(<img> 태그가 로드한 CORS 헤더 없는 캐시)를
    // 사용할 경우 CORS 에러가 발생할 수 있으므로, 캐시 우회를 위해 파라미터를 추가합니다.
    const cacheUrl = new URL(url);
    cacheUrl.searchParams.set("t", Date.now().toString());

    // S3 공개 객체는 쿠키가 필요 없고, 쿠키를 같이 보내면 Allow-Origin: * 응답이 CORS 에러가 되므로 빼고 보낸다
    const response = await fetch(cacheUrl.toString(), {
      mode: "cors",
      credentials: "omit",
    });

    if (response.ok) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch (error) {
    logger.warn("Direct S3 fetch failed, falling back to same-origin proxy:", error);
  }

  // Fallback: /_next/image는 1920px로 줄이고 다시 압축해 화질이 떨어지므로, 원본 그대로 전달하는 프록시를 쓴다
  const proxyResponse = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);

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

  // Canvas는 CSS 변수를 직접 해석하지 않으므로 현재 테마의 실제 색상을 읽는다
  ctx.fillStyle =
    getComputedStyle(document.documentElement).getPropertyValue("--color-surface-primary").trim() || "black";
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
