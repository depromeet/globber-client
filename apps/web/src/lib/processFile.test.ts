import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { processSingleFile } from "./processFile";

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("exifr", () => ({ default: { parse } }));
vi.mock("heic2any", () => ({ default: async () => new Blob(["jpeg"], { type: "image/jpeg" }) }));

describe("processSingleFile 실제 업로드 크기", () => {
  let decodeFails = false;
  beforeEach(() => {
    decodeFails = false;
    parse.mockReset();
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 640;
        naturalHeight = 480;
        onload?: () => void;
        onerror?: () => void;
        set src(_value: string) {
          queueMicrotask(() => (decodeFails ? this.onerror?.() : this.onload?.()));
        }
      }
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("EXIF가 없는 PNG도 실제 크기를 보존한다", async () => {
    parse.mockResolvedValue(undefined);
    const { metadata } = await processSingleFile(new File(["png"], "photo.png", { type: "image/png" }));
    expect(metadata.status).toBe("completed");
    expect(metadata.dimensions).toEqual({ width: 640, height: 480 });
    URL.revokeObjectURL(metadata.imagePreview);
  });

  it("EXIF 파싱 오류가 나도 디코딩 가능한 사진은 실제 크기를 보존한다", async () => {
    parse.mockRejectedValue(new Error("잘못된 EXIF"));
    const { metadata } = await processSingleFile(new File(["png"], "photo.png", { type: "image/png" }));
    expect(metadata.status).toBe("completed");
    expect(metadata.dimensions).toEqual({ width: 640, height: 480 });
    URL.revokeObjectURL(metadata.imagePreview);
  });

  it("EXIF의 원본 크기 대신 변환된 HEIC의 실제 크기를 사용한다", async () => {
    parse.mockResolvedValue({ ImageWidth: 4000, ImageHeight: 3000 });
    const { metadata, uploadFile } = await processSingleFile(new File(["heic"], "photo.heic", { type: "image/heic" }));
    expect(uploadFile.type).toBe("image/jpeg");
    expect(metadata.dimensions).toEqual({ width: 640, height: 480 });
    URL.revokeObjectURL(metadata.imagePreview);
  });

  it("디코딩 불가능한 사진은 완료로 표시하지 않고 거절한다", async () => {
    decodeFails = true;
    parse.mockResolvedValue(undefined);
    await expect(processSingleFile(new File(["broken"], "broken.jpg", { type: "image/jpeg" }))).rejects.toThrow();
  });
});
