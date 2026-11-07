import { type NextRequest, NextResponse } from "next/server";

import { parseCoordinates } from "../_lib/coordinates";
import { reportUpstreamError } from "../_lib/reportUpstreamError";

/**
 * Geocoding API 역지오코딩
 * 좌표를 주소로 바꿉니다.
 *
 * @example GET /api/geocode?lat=37.4850&lng=127.0178
 */
export async function GET(request: NextRequest) {
  const coordinates = parseCoordinates(new URL(request.url).searchParams);
  if (!coordinates) return NextResponse.json({ error: "lat/lng must be valid coordinates" }, { status: 400 });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Google Maps API Key is not configured" }, { status: 500 });

  try {
    const qs = new URLSearchParams({
      latlng: `${coordinates.lat},${coordinates.lng}`,
      key: apiKey,
      language: "ko",
      region: "kr",
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${qs.toString()}`);
    if (!response.ok) {
      reportUpstreamError("geocode-proxy", `HTTP ${response.status}`);
      return NextResponse.json({ error: `Geocoding API responded with status ${response.status}` }, { status: 502 });
    }

    const data = await response.json();

    // REQUEST_DENIED 같은 오류도 결과가 빈 배열로 오므로, 결과보다 status를 먼저 확인한다.
    if (data.status === "ZERO_RESULTS") return NextResponse.json({ results: [] });
    if (data.status !== "OK") {
      reportUpstreamError("geocode-proxy", String(data.status), data.error_message);
      return NextResponse.json({ error: `Geocoding API error: ${data.status}` }, { status: 502 });
    }

    return NextResponse.json({ results: data.results ?? [] });
  } catch {
    console.error("[geocode] fetch failed");
    return NextResponse.json({ error: "Geocoding failed" }, { status: 500 });
  }
}
