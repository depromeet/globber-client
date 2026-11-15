import { type NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE } from "@/constants/authCookies";
import { ApiError, apiGet } from "@/lib/apiClient";

// 확인된 토큰은 잠시 기억해 사진마다 백엔드에 다시 묻지 않는다.
const VERIFIED_TOKEN_TTL_MS = 10 * 60 * 1000;
// 토큰 확인이 오래 걸리면 장소명 변환 전체가 늦어지므로 짧게 끊는다.
const VERIFY_TIMEOUT_MS = 3000;
// 사진 한 장에 Places·Geocoding을 합쳐 2~3번 호출하므로, 사진을 여러 장 올려도 걸리지 않게 여유 있게 잡는다.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
// 메모리가 끝없이 늘지 않도록 기억하는 토큰 수를 제한한다.
const MAX_TRACKED_TOKENS = 5000;

const verifiedTokens = new Map<string, number>();
const requestCounts = new Map<string, { windowStart: number; count: number }>();

const pruneIfFull = <V>(map: Map<string, V>) => {
  if (map.size < MAX_TRACKED_TOKENS) return;
  const oldestKey = map.keys().next().value;
  if (oldestKey !== undefined) map.delete(oldestKey);
};

/** 백엔드에 내 프로필을 조회해 토큰이 실제로 유효한지 확인한다. */
const verifyToken = async (token: string, now: number): Promise<"ok" | "invalid" | "unavailable"> => {
  const expiresAt = verifiedTokens.get(token);
  if (expiresAt && expiresAt > now) return "ok";

  try {
    await apiGet("/api/v1/profiles/me", {}, token, {
      skipGlobalErrorHandling: true,
      timeoutMs: VERIFY_TIMEOUT_MS,
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return "invalid";
    return "unavailable";
  }

  pruneIfFull(verifiedTokens);
  verifiedTokens.set(token, now + VERIFIED_TOKEN_TTL_MS);
  return "ok";
};

const isRateLimited = (token: string, now: number) => {
  const entry = requestCounts.get(token);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    pruneIfFull(requestCounts);
    requestCounts.set(token, { windowStart: now, count: 1 });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
};

/**
 * Google Maps 프록시(/api/places, /api/geocode)를 로그인한 사용자만, 정해진 횟수 안에서 쓸 수 있게 막습니다 (GLB-129).
 * 두 API는 기록 작성 화면에서만 쓰여 비로그인 화면에는 영향이 없습니다.
 * 통과하면 null, 막아야 하면 바로 돌려줄 응답을 반환합니다.
 */
export const checkMapsAccess = async (request: NextRequest): Promise<NextResponse | null> => {
  const token = request.cookies.get(AUTH_COOKIE.ACCESS_TOKEN)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();
  const verification = await verifyToken(token, now);
  if (verification === "invalid") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (verification === "unavailable")
    return NextResponse.json({ error: "Authentication check unavailable" }, { status: 503 });

  if (isRateLimited(token, now))
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(RATE_LIMIT_WINDOW_MS / 1000) } }
    );

  return null;
};
