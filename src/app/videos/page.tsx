"use client";

import { useEffect, useState } from "react";
import { VideosTable } from "@/components/videos-table";

interface Video {
  id: number;
  youtubeId: string;
  url: string | null;
  title: string | null;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  lastUpdated: string | null;
  eventId: number | null;
  eventName: string | null;
  excludeFromCharts: number;
  speakers: { id: number; firstName: string; lastName: string }[];
  ageInDays: number | null;
  viewsPerDay: number | null;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [events, setEvents] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeExcluded, setIncludeExcluded] = useState(false);

  useEffect(() => {
    setLoading(true);
    const videosUrl = includeExcluded ? "/api/videos?includeExcluded=true" : "/api/videos";
    Promise.all([
      fetch(videosUrl).then((r) => r.ok ? r.json() : []),
      fetch("/api/events").then((r) => r.ok ? r.json() : []),
    ]).then(([vids, evts]) => {
      setVideos(Array.isArray(vids) ? vids : []);
      setEvents(Array.isArray(evts) ? evts : []);
    }).catch((err) => {
      console.error("Failed to fetch videos:", err);
    }).finally(() => {
      setLoading(false);
    });
  }, [includeExcluded]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading videos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Videos</h1>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeExcluded}
            onChange={(e) => setIncludeExcluded(e.target.checked)}
            className="h-4 w-4"
          />
          Show excluded
        </label>
      </div>
      <VideosTable videos={videos} events={events} />
    </div>
  );
}
