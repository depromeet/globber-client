import { type NextRequest, NextResponse } from "next/server";

import { serverEnv } from "@/config/env";

import { parseCoordinates } from "../_lib/coordinates";
import { reportUpstreamError } from "../_lib/reportUpstreamError";

const DEFAULT_RADIUS = 100;
const MAX_RADIUS = 1000;

/**
 * Places API Nearby Search
 * 좌표 주변의 장소명(POI)을 검색합니다.
 *
 * @example GET /api/places?lat=37.4850&lng=127.0178&radius=50
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const coordinates = parseCoordinates(searchParams);
  if (!coordinates) return NextResponse.json({ error: "lat/lng must be valid coordinates" }, { status: 400 });

  const radius = Number(searchParams.get("radius") ?? DEFAULT_RADIUS);
  if (!Number.isFinite(radius) || radius < 1 || radius > MAX_RADIUS)
    return NextResponse.json({ error: `radius must be between 1 and ${MAX_RADIUS}` }, { status: 400 });

  const apiKey = serverEnv.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API Key not configured" }, { status: 500 });

  try {
    const qs = new URLSearchParams({
      location: `${coordinates.lat},${coordinates.lng}`,
      radius: String(radius),
      key: apiKey,
      language: "ko",
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?${qs.toString()}`);
    if (!response.ok) {
      reportUpstreamError("places-proxy", `HTTP ${response.status}`);
      return NextResponse.json({ error: `Places API responded with status ${response.status}` }, { status: 502 });
    }

    const data = await response.json();

    // REQUEST_DENIED 같은 오류도 결과가 빈 배열로 오므로, 결과보다 status를 먼저 확인한다.
    if (data.status === "ZERO_RESULTS") return NextResponse.json({ results: [] });
    if (data.status !== "OK") {
      reportUpstreamError("places-proxy", String(data.status), data.error_message);
      return NextResponse.json({ error: `Places API error: ${data.status}` }, { status: 502 });
    }

    return NextResponse.json({ results: data.results ?? [] });
  } catch (error) {
    console.error("[places] request failed:", error);
    return NextResponse.json({ error: "Places search failed" }, { status: 500 });
  }
}
