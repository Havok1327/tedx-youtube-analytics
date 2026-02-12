import { NextRequest, NextResponse } from "next/server";
import { extractVideoId, fetchVideoInfo } from "@/lib/youtube";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: "Could not extract video ID from URL" }, { status: 400 });
    }

    const info = await fetchVideoInfo(videoId);
    if (!info) {
      return NextResponse.json({ error: "Video not found or unavailable" }, { status: 404 });
    }

    return NextResponse.json(info);
  } catch (error) {
    console.error("YouTube lookup error:", error);
    return NextResponse.json({ error: "Lookup failed", details: String(error) }, { status: 500 });
  }
}
