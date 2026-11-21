import type { DiariesListResponse } from "@globber/shared/types/diary";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({ env: { S3_BASE_URL: "https://bucket.test/" } }));

import { getDiaryThumbnails } from "./diaryThumbnailMapper";

type DiaryResponses = DiariesListResponse["data"]["diaryResponses"];

const city = { cityId: 1, cityName: "서울", countryName: "대한민국", lat: 37.5, lng: 127, countryCode: "KOR" };

const buildResponses = (photo: Record<string, unknown>): DiaryResponses =>
  [
    {
      city,
      diaries: [
        {
          diaryId: 10,
          city,
          text: "",
          createdAt: "2026-11-01T00:00:00Z",
          updatedAt: "2026-11-01T00:00:00Z",
          photos: [
            {
              photoId: 1,
              width: 1,
              height: 1,
              takenMonth: null,
              placeName: null,
              tag: "NONE",
              lat: null,
              lng: null,
              ...photo,
            },
          ],
          emojis: [],
          memberId: 1,
          nickname: "a",
        },
      ],
    },
  ] as unknown as DiaryResponses;

describe("getDiaryThumbnails (GLB-397)", () => {
  it("새 응답은 서버의 전체 URL(photoUrl)을 그대로 쓴다", () => {
    const result = getDiaryThumbnails(
      buildResponses({ photoCode: "travels/1/a.jpg", photoUrl: "https://cdn.test/travels/1/a.jpg" })
    );
    expect(result.cityThumbnails[1]).toBe("https://cdn.test/travels/1/a.jpg");
    expect(result.countryThumbnails.KOR).toBe("https://cdn.test/travels/1/a.jpg");
  });

  it("서버가 만든 썸네일(thumbnailUrl)이 있으면 원본보다 먼저 쓴다", () => {
    const result = getDiaryThumbnails(
      buildResponses({
        photoCode: "travels/1/a.jpg",
        photoUrl: "https://cdn.test/travels/1/a.jpg",
        thumbnailUrl: "https://cdn.test/thumbnails/1/a.webp",
      })
    );
    expect(result.cityThumbnails[1]).toBe("https://cdn.test/thumbnails/1/a.webp");
    expect(result.cityThumbnailsArray[1]).toEqual(["https://cdn.test/thumbnails/1/a.webp"]);
  });

  it("예전 응답(photoUrl 없음)은 S3 키로 주소를 만든다", () => {
    const result = getDiaryThumbnails(buildResponses({ photoCode: "travels/1/a.jpg" }));
    expect(result.cityThumbnails[1]).toBe("https://bucket.test/travels/1/a.jpg");
  });
});
