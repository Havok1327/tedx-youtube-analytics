"use client";

import { useEffect, useState } from "react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { TopPerformersChart } from "@/components/dashboard/top-performers-chart";
import { GrowthChart } from "@/components/dashboard/growth-chart";
import { EventComparisonChart } from "@/components/dashboard/event-comparison-chart";
import { Milestones } from "@/components/dashboard/milestones";
import Link from "next/link";

interface OverviewData {
  summary: {
    totalVideos: number;
    totalViews: number;
    totalLikes: number;
    avgViewsPerDay: number;
  };
  top15: { id: number; title: string; views: number; youtubeId: string }[];
  eventComparison: { eventName: string; avgViews: number; videoCount: number; totalViews: number }[];
  growthOverTime: { date: string; totalViews: number; totalLikes: number }[];
  milestones: { videoId: number; title: string; views: number; milestone: number }[];
}

export default function Dashboard() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  const fetchData = async (incExcluded: boolean) => {
    try {
      const url = incExcluded ? "/api/stats/overview?includeExcluded=true" : "/api/stats/overview";
      const res = await fetch(url);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch overview:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(includeExcluded);
  }, [includeExcluded]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((settings) => {
        if (settings.last_refresh_at) setLastRefreshAt(settings.last_refresh_at);
      })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">No data available. Import your CSV files to get started.</p>
        <a href="/manage" className="text-primary underline">
          Go to Manage page
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeExcluded}
              onChange={(e) => setIncludeExcluded(e.target.checked)}
              className="h-4 w-4"
            />
            Show excluded
          </label>
          {lastRefreshAt && (
            <span className="text-xs text-muted-foreground">
              Last refreshed: {new Date(lastRefreshAt).toLocaleDateString()}
            </span>
          )}
          <Link href="/manage" className="text-xs text-primary hover:underline">
            Refresh Stats &rarr;
          </Link>
        </div>
      </div>

      <SummaryCards
        totalVideos={data.summary.totalVideos}
        totalViews={data.summary.totalViews}
        totalLikes={data.summary.totalLikes}
        avgViewsPerDay={data.summary.avgViewsPerDay}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <TopPerformersChart data={data.top15} />
        <Milestones data={data.milestones} />
      </div>

      <GrowthChart data={data.growthOverTime} />

      <EventComparisonChart data={data.eventComparison} />
    </div>
  );
}
