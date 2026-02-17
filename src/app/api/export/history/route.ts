import { NextResponse } from "next/server";
import { db } from "@/db";
import { statsHistory, videos, events, speakers, videoSpeakers } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    // Fetch all history with video info
    const rows = await db
      .select({
        recordedAt: statsHistory.recordedAt,
        views: statsHistory.views,
        likes: statsHistory.likes,
        videoId: statsHistory.videoId,
        videoTitle: videos.title,
        eventName: events.name,
      })
      .from(statsHistory)
      .innerJoin(videos, eq(statsHistory.videoId, videos.id))
      .leftJoin(events, eq(videos.eventId, events.id))
      .orderBy(asc(statsHistory.recordedAt), asc(statsHistory.videoId))
      .all();

    // Fetch all speaker associations
    const allVideoSpeakers = await db
      .select({
        videoId: videoSpeakers.videoId,
        firstName: speakers.firstName,
        lastName: speakers.lastName,
      })
      .from(videoSpeakers)
      .innerJoin(speakers, eq(videoSpeakers.speakerId, speakers.id))
      .all();

    const speakersByVideo = new Map<number, string>();
    for (const vs of allVideoSpeakers) {
      const existing = speakersByVideo.get(vs.videoId);
      const name = `${vs.firstName} ${vs.lastName}`.trim();
      speakersByVideo.set(vs.videoId, existing ? `${existing}; ${name}` : name);
    }

    // Build CSV
    const escapeField = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const headers = ["Date", "Video Title", "Speaker(s)", "Event", "Views", "Likes"];
    const csvRows = rows.map((r) => [
      r.recordedAt ? new Date(r.recordedAt).toISOString().slice(0, 10) : "",
      escapeField(r.videoTitle || "Untitled"),
      escapeField(speakersByVideo.get(r.videoId) || "Unknown"),
      escapeField(r.eventName || ""),
      (r.views || 0).toString(),
      (r.likes || 0).toString(),
    ]);

    const csv = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tedx-view-history-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting history:", error);
    return NextResponse.json({ error: "Failed to export history" }, { status: 500 });
  }
}
