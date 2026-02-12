"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryCardsProps {
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  avgViewsPerDay: number;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function SummaryCards({ totalVideos, totalViews, totalLikes, avgViewsPerDay }: SummaryCardsProps) {
  const cards = [
    { title: "Total Videos", value: totalVideos.toLocaleString(), description: "Tracked on YouTube" },
    { title: "Total Views", value: formatNumber(totalViews), description: "Across all videos" },
    { title: "Total Likes", value: formatNumber(totalLikes), description: "Across all videos" },
    { title: "Avg Views/Day", value: avgViewsPerDay.toFixed(1), description: "Per video average" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
