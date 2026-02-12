"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MilestonesProps {
  data: { videoId: number; title: string; views: number; milestone: number }[];
}

function formatMilestone(n: number): string {
  if (n >= 100000) return "100K+";
  if (n >= 10000) return "10K+";
  return "1K+";
}

function milestoneColor(n: number): string {
  if (n >= 100000) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  if (n >= 10000) return "bg-blue-100 text-blue-800 border-blue-300";
  return "bg-green-100 text-green-800 border-green-300";
}

export function Milestones({ data }: MilestonesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Milestones</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No milestones yet</p>
        ) : (
          <div className="space-y-3">
            {data.map((item) => (
              <Link
                key={item.videoId}
                href={`/videos/${item.videoId}`}
                className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-accent transition-colors"
              >
                <span className="text-sm truncate flex-1">{item.title}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm text-muted-foreground">
                    {item.views.toLocaleString()} views
                  </span>
                  <Badge variant="outline" className={milestoneColor(item.milestone)}>
                    {formatMilestone(item.milestone)}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
