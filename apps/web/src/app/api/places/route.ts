import { type NextRequest, NextResponse } from "next/server";

/**
 * Places API Nearby Search
 * 좌표 주변의 장소명(POI)을 검색합니다.
 *
 * @example GET /api/places?lat=37.4850&lng=127.0178&radius=50
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = searchParams.get("radius") || "100"; // 기본 반경 100m

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }

  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API Key not configured" }, { status: 500 });
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&key=${apiKey}&language=ko`
    );
    const data = await response.json();

    if (data.status === "ZERO_RESULTS" || !data.results || data.results.length === 0) {
      return NextResponse.json({ results: [] });
    }

    if (data.status !== "OK") {
      console.error("Places API error:", data.status, data.error_message);
      return NextResponse.json({ error: `Places API error: ${data.status}` }, { status: 500 });
    }

    return NextResponse.json({ results: data.results });
  } catch (error) {
    console.error("Places API request failed:", error);
    return NextResponse.json({ error: "Places search failed" }, { status: 500 });
  }
}
