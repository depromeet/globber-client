import { NextRequest, NextResponse } from "next/server";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { GET } from "./route";

const { access } = vi.hoisted(() => ({ access: { denied: null as NextResponse | null } }));

vi.mock("@/config/env", () => ({ env: { S3_BASE_URL: "https://globber-dev.s3.ap-northeast-2.amazonaws.com/" } }));
vi.mock("../_lib/mapsAccess", () => ({ checkMapsAccess: async () => access.denied }));

const PHOTO_URL = "https://globber-prod.s3.ap-northeast-2.amazonaws.com/photo.jpg";
const request = (url?: string) =>
  new NextRequest(`https://globber.world/api/image-proxy${url ? `?url=${encodeURIComponent(url)}` : ""}`);

const fetchMock = vi.fn();

beforeEach(() => {
  access.denied = null;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("로그인 확인에서 막히면 S3를 호출하지 않고 그 응답을 돌려준다", async () => {
  access.denied = NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const response = await GET(request(PHOTO_URL));

  expect(response.status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([
  ["url이 없으면", undefined, 400],
  ["url 형식이 아니면", "not a url", 400],
  ["허용하지 않은 호스트면", "https://evil.example/photo.jpg", 403],
  ["https가 아니면", "http://globber-prod.s3.ap-northeast-2.amazonaws.com/photo.jpg", 403],
])("%s S3를 호출하지 않는다", async (_, url, status) => {
  const response = await GET(request(url));

  expect(response.status).toBe(status);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("허용한 S3 사진은 원본 그대로 전달하고, 리다이렉트는 따라가지 않는다", async () => {
  fetchMock.mockResolvedValue(new Response("image-bytes", { headers: { "content-type": "image/jpeg" } }));

  const response = await GET(request(PHOTO_URL));

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/jpeg");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await response.text()).toBe("image-bytes");
  expect(fetchMock).toHaveBeenCalledWith(new URL(PHOTO_URL), expect.objectContaining({ redirect: "error" }));
});

it.each([
  ["이미지가 아니면", "text/html"],
  ["SVG면", "image/svg+xml"],
  ["대문자로 적힌 SVG여도", "image/SVG+xml"],
])("%s 전달하지 않고 S3 본문을 취소한다", async (_, contentType) => {
  const s3Response = new Response("<svg/>", { headers: { "content-type": contentType } });
  const cancel = vi.spyOn(s3Response.body!, "cancel");
  fetchMock.mockResolvedValue(s3Response);

  const response = await GET(request(PHOTO_URL));

  expect(response.status).toBe(502);
  expect(cancel).toHaveBeenCalled();
});

it("업로드 최대 크기보다 큰 사진은 전달하지 않고 S3 본문을 취소한다", async () => {
  const s3Response = new Response("x", {
    headers: { "content-type": "image/jpeg", "content-length": String(11 * 1024 * 1024) },
  });
  const cancel = vi.spyOn(s3Response.body!, "cancel");
  fetchMock.mockResolvedValue(s3Response);

  const response = await GET(request(PHOTO_URL));

  expect(response.status).toBe(413);
  expect(cancel).toHaveBeenCalled();
});

it("S3 응답이 실패하거나 요청이 끊기면 502를 돌려준다", async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
  expect((await GET(request(PHOTO_URL))).status).toBe(502);

  fetchMock.mockRejectedValueOnce(new TypeError("redirect"));
  expect((await GET(request(PHOTO_URL))).status).toBe(502);
});
