import { createElement, useLayoutEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useImageMetadata } from "./useImageMetadata";

const deps = vi.hoisted(() => ({
  router: { back: vi.fn(), replace: vi.fn() },
  upload: vi.fn(),
  process: vi.fn(),
  diary: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => deps.router }));
vi.mock("@next/third-parties/google", () => ({ sendGAEvent: vi.fn() }));
vi.mock("@/config/env", () => ({ env: { S3_BASE_URL: "https://photo.example/" } }));
vi.mock("@/hooks/mutation/useDiaryMutations", () => ({
  useUploadTravelPhotoMutation: () => ({ mutateAsync: deps.upload }),
}));
vi.mock("@/services/diaryService", () => ({ getDiaryDetail: deps.diary }));
vi.mock("@/utils/sentry", () => ({ reportError: vi.fn() }));
vi.mock("@/components/common/GlobalToast", () => ({ toast: { error: deps.toastError, success: vi.fn() } }));
vi.mock("@/lib/processFile", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/processFile")>()),
  processSingleFile: deps.process,
}));

describe("사진 편집 훅 회귀", () => {
  let renderer: ReactTestRenderer;
  let hook: ReturnType<typeof useImageMetadata>;
  const mount = async (isEditMode = false) => {
    const Probe = () => {
      const value = useImageMetadata({ isEditMode, diaryId: isEditMode ? 42 : undefined });
      useLayoutEffect(() => {
        hook = value;
      });
      return null;
    };
    await act(async () => {
      renderer = create(createElement(Probe));
    });
  };
  const choose = async (count: number) => {
    const target = {
      files: Array.from({ length: count }, (_, index) => new File(["jpeg"], `${index}.jpg`, { type: "image/jpeg" })),
      value: "selected",
    };
    await act(async () => {
      await hook.handleFileUpload({ target } as unknown as React.ChangeEvent<HTMLInputElement>);
    });
    expect(target.value).toBe("");
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    deps.upload.mockResolvedValue("new/photo.jpg");
    deps.process.mockImplementation(async (file: File) => ({
      uploadFile: file,
      metadata: {
        id: file.name,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        status: "completed",
        imagePreview: URL.createObjectURL(file),
        dimensions: { width: 800, height: 600 },
      },
    }));
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 320;
        naturalHeight = 240;
        onload?: () => void;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      }
    );
  });
  afterEach(async () => {
    if (renderer) await act(async () => renderer.unmount());
    vi.unstubAllGlobals();
  });

  it("4장을 선택하면 3장만 추가하고 초과 안내를 표시한다", async () => {
    await mount();
    await choose(4);
    expect(hook.metadataList).toHaveLength(3);
    expect(deps.toastError).toHaveBeenCalledWith(
      "사진은 최대 3장까지 올릴 수 있어요. 선택한 사진 중 1장은 제외했어요."
    );
  });

  it("이미 2장이 있을 때 2장을 더 선택하면 남은 1장만 추가하고 안내한다", async () => {
    await mount();
    await choose(2);
    await choose(2);
    expect(hook.metadataList).toHaveLength(3);
    expect(deps.toastError).toHaveBeenCalledWith(
      "사진은 최대 3장까지 올릴 수 있어요. 선택한 사진 중 1장은 제외했어요."
    );
  });

  it("직접 연 수정 URL에서 조회가 실패하면 기록 선택 화면으로 이동한다", async () => {
    deps.diary.mockRejectedValueOnce(new Error("조회 실패"));
    await mount(true);
    expect(deps.router.replace).toHaveBeenCalledWith("/record");
    expect(deps.router.back).not.toHaveBeenCalled();
    expect(hook.isInitialLoading).toBe(false);
  });

  it("처리 오류 메타데이터는 업로드와 목록에서 제외한다", async () => {
    deps.process.mockResolvedValueOnce({
      uploadFile: new File(["x"], "broken.jpg"),
      metadata: {
        id: "broken",
        status: "error",
        imagePreview: "blob:broken",
        error: "디코딩 실패",
      },
    });
    await mount();
    await choose(1);
    expect(hook.metadataList).toEqual([]);
    expect(deps.upload).not.toHaveBeenCalled();
    expect(deps.toastError).toHaveBeenCalled();
  });

  it("크롭한 사진에는 원본 대신 결과 이미지의 크기를 기록한다", async () => {
    await mount();
    await choose(1);
    const id = hook.metadataList[0].id;
    vi.stubGlobal("fetch", async () => ({ blob: async () => new Blob(["crop"], { type: "image/jpeg" }) }));
    await act(async () => {
      await hook.handleImageUpdate(id, "blob:crop");
    });
    expect(hook.metadataList[0].dimensions).toEqual({ width: 320, height: 240 });
  });

  it("크롭 업로드 중에는 처리 상태를 유지하고 해당 사진을 삭제하지 않는다", async () => {
    await mount();
    await choose(1);
    const id = hook.metadataList[0].id;
    vi.stubGlobal("fetch", async () => ({ blob: async () => new Blob(["crop"], { type: "image/jpeg" }) }));
    let finish!: (value: string) => void;
    deps.upload.mockImplementationOnce(
      () =>
        new Promise<string>(resolve => {
          finish = resolve;
        })
    );
    let cropping!: Promise<void>;
    await act(async () => {
      cropping = hook.handleImageUpdate(id, "blob:crop");
    });
    expect(hook.isProcessing).toBe(true);
    await act(async () => {
      hook.handleRemove(id);
    });
    expect(hook.metadataList).toHaveLength(1);
    await act(async () => {
      finish("crop.jpg");
      await cropping;
    });
    expect(hook.isProcessing).toBe(false);
  });
});
