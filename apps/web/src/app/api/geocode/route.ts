import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (
    !Number.isFinite(latNum) ||
    !Number.isFinite(lngNum) ||
    latNum < -90 ||
    latNum > 90 ||
    lngNum < -180 ||
    lngNum > 180
  )
    return NextResponse.json({ error: "lat/lng must be valid coordinates" }, { status: 400 });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Google Maps API Key is not configured" }, { status: 500 });

  try {
    const qs = new URLSearchParams({
      latlng: `${latNum},${lngNum}`,
      key: apiKey,
      language: "ko",
      region: "kr",
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${qs.toString()}`);
    if (!response.ok)
      return NextResponse.json({ error: `Geocoding API responded with status ${response.status}` }, { status: 502 });

    const data = await response.json();
    return NextResponse.json({ results: data.results });
  } catch {
    console.error("[geocode] fetch failed");
    return NextResponse.json({ error: "Geocoding failed" }, { status: 500 });
  }
}
