import type { ImageMetadata } from "@globber/shared/types/imageMetadata";
import exifr from "exifr";

import { reverseGeocode } from "@/utils/geocoding";

/**
 * 업로드할 이미지에서 실제 표시 크기를 측정한다.
 * @param file - 크기를 측정할 이미지
 * @returns 디코딩된 이미지의 너비와 높이
 */
export const getImageDimensions = async (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        reject(new Error("이미지 크기를 측정할 수 없습니다."));
        return;
      }
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지 크기를 측정할 수 없습니다."));
    };

    img.src = url;
  });
};

export const processSingleFile = async (file: File): Promise<{ metadata: ImageMetadata; uploadFile: File }> => {
  const id = Math.random().toString(36).substr(2, 9);
  const extracted: ImageMetadata = {
    id,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    imagePreview: URL.createObjectURL(file),
    status: "processing",
  };

  // HEIC/HEIF 파일 여부 판별 (MIME 타입 또는 확장자 기준)
  const isHeic =
    file.type.toLowerCase().includes("heic") ||
    file.type.toLowerCase().includes("heif") ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name);
  // S3에 실제로 올릴 파일 (HEIC → JPEG 변환 성공 시 교체, 아니면 원본 유지)
  let uploadFile: File = file;

  if (isHeic) {
    try {
      // HEIC → JPEG 변환 실패 시 원본 HEIC를 그대로 업로드하지 않도록,
      // 실패를 삼키지 않고 호출부(useImageMetadata)로 전파해 업로드 자체를 막는다.
      const { default: heic2any } = await import("heic2any");
      const converted = await heic2any({
        blob: file as unknown as Blob,
        toType: "image/jpeg",
        quality: 0.92,
      });
      const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
      if (!(jpegBlob instanceof Blob)) {
        throw new Error(`HEIC 변환에 실패했습니다: ${file.name}`);
      }

      // 미리보기 URL 교체 (메모리 누수 방지: 기존 Object URL 해제)
      const newUrl = URL.createObjectURL(jpegBlob);
      URL.revokeObjectURL(extracted.imagePreview);
      extracted.imagePreview = newUrl;

      // S3 업로드용 JPEG File 객체 생성 (.heic → .jpg, MIME 타입 image/jpeg)
      const jpegFileName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
      uploadFile = new File([jpegBlob], jpegFileName, { type: "image/jpeg" });
    } catch (error) {
      // 변환에 실패하면 이 파일은 목록에 들어가지 않으므로, 만들어 둔 미리보기 URL을 해제한다
      URL.revokeObjectURL(extracted.imagePreview);
      throw error;
    }
  }

  try {
    // EXIF의 크기는 회전·변환 전 값일 수 있으므로 실제 업로드 파일을 측정한다
    extracted.dimensions = await getImageDimensions(uploadFile);
    let exifData: Record<string, unknown> = {};
    try {
      exifData = (await exifr.parse(file)) ?? {};
    } catch {
      // EXIF 손상만으로 디코딩 가능한 사진의 업로드를 막지 않는다
    }

    if (exifData.Make || exifData.Model || exifData.Software)
      extracted.camera = {
        make: (exifData.Make as string) || "",
        model: (exifData.Model as string) || "",
        software: (exifData.Software as string) || "",
      };
    if (exifData.ISO || exifData.FNumber || exifData.ExposureTime || exifData.FocalLength || exifData.Flash)
      extracted.settings = {
        iso: (exifData.ISO as number) || 0,
        aperture: (exifData.FNumber as number) || 0,
        shutterSpeed: exifData.ExposureTime ? `1/${Math.round(1 / (exifData.ExposureTime as number))}s` : "",
        focalLength: (exifData.FocalLength as number) || 0,
        flash: exifData.Flash ? (exifData.Flash as number) !== 0 : false,
      };
    if (exifData.latitude && exifData.longitude) {
      // 백엔드 API로 주소, 장소 정보 요청 (키 노출 X)
      const lat = exifData.latitude as number;
      const lng = exifData.longitude as number;
      const placeName = await reverseGeocode(lat, lng);
      const address = placeName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      extracted.location = {
        latitude: lat,
        longitude: lng,
        altitude: exifData.altitude as number,
        address,
        nearbyPlaces: [address],
      };
    }
    if (exifData.DateTimeOriginal) extracted.timestamp = new Date(exifData.DateTimeOriginal as string).toISOString();
    if (exifData.Orientation) extracted.orientation = exifData.Orientation as number;
    extracted.status = "completed";
    return { metadata: extracted, uploadFile };
  } catch (error) {
    URL.revokeObjectURL(extracted.imagePreview);
    throw error;
  }
};
