import { type NextRequest, NextResponse } from "next/server";

import { env } from "@/config/env";
import { UPLOAD_IMAGE_MAX_SIZE_BYTES } from "@/constants/image";

import { checkMapsAccess } from "../_lib/mapsAccess";

const getHostname = (value?: string) => {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
};

// 열린 프록시가 되지 않도록 사진을 저장하는 S3 버킷만 허용한다
const ALLOWED_HOSTS = new Set(
  [
    "globber-dev.s3.ap-northeast-2.amazonaws.com",
    "globber-prod.s3.ap-northeast-2.amazonaws.com",
    getHostname(env.S3_BASE_URL),
  ].filter((host): host is string => Boolean(host))
);

/**
 * S3에 저장된 사진 원본을 같은 출처로 그대로 전달합니다 (GLB-264).
 * S3 CORS 설정과 관계없이 자르기 화면이 원본 화질 사진을 canvas에서 쓸 수 있게 합니다.
 * 기록 편집 화면에서만 쓰므로 로그인한 사용자만 호출할 수 있습니다.
 *
 * @example GET /api/image-proxy?url=https://globber-prod.s3.ap-northeast-2.amazonaws.com/photo.jpg
 */
export async function GET(request: NextRequest) {
  const denied = await checkMapsAccess(request);
  if (denied) return denied;

  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: "host not allowed" }, { status: 403 });
  }

  try {
    // 리다이렉트를 따라가면 허용하지 않은 호스트로 나갈 수 있어 막는다
    const response = await fetch(target, { cache: "no-store", redirect: "error" });
    // MIME 타입은 대소문자를 구분하지 않으므로 소문자로 맞춰 검사한다
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const contentLength = Number(response.headers.get("content-length") ?? 0);

    // 거절한 응답의 본문을 읽지 않고 두면 S3 연결이 바로 반납되지 않으므로 취소한다
    const reject = async (error: string, status: number) => {
      await response.body?.cancel().catch(() => {});
      return NextResponse.json({ error }, { status });
    };

    // SVG는 스크립트를 담을 수 있어 같은 출처로 내보내지 않는다
    if (!response.ok || !response.body || !contentType.startsWith("image/") || contentType.includes("svg")) {
      return reject("failed to fetch image", 502);
    }
    if (contentLength > UPLOAD_IMAGE_MAX_SIZE_BYTES) {
      return reject("image too large", 413);
    }

    return new NextResponse(response.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[image-proxy] fetch failed:", error);
    return NextResponse.json({ error: "failed to fetch image" }, { status: 502 });
  }
}
