"use client";

import { useEffect, useState, useCallback } from "react";
import { VideosTable } from "@/components/videos-table";
import { Button } from "@/components/ui/button";

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
  const [clearing, setClearing] = useState(false);

  const fetchVideos = useCallback(() => {
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

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const excludedCount = videos.filter((v) => v.excludeFromCharts).length;

  const handleClearExclusions = async () => {
    if (!confirm(`Remove exclusions from all ${excludedCount} excluded video${excludedCount !== 1 ? "s" : ""}? They will appear in all charts and analytics again.`)) {
      return;
    }
    setClearing(true);
    try {
      const res = await fetch("/api/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear-exclusions" }),
      });
      if (res.ok) {
        fetchVideos();
      } else {
        console.error("Failed to clear exclusions");
      }
    } catch (err) {
      console.error("Error clearing exclusions:", err);
    } finally {
      setClearing(false);
    }
  };

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
        <div className="flex items-center gap-4">
          {includeExcluded && excludedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearExclusions}
              disabled={clearing}
              className="text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700"
            >
              {clearing ? "Removing..." : `Remove All Exclusions (${excludedCount})`}
            </Button>
          )}
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
      </div>
      <VideosTable videos={videos} events={events} />
    </div>
  );
}
