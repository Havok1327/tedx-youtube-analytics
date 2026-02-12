"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TopPerformersChartProps {
  data: { id: number; title: string; views: number; youtubeId: string }[];
}

export function TopPerformersChart({ data }: TopPerformersChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    shortTitle: d.title && d.title.length > 40 ? d.title.substring(0, 37) + "..." : d.title || "Untitled",
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 15 Videos by Views</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 200, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
            <YAxis type="category" dataKey="shortTitle" width={190} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value) => [Number(value).toLocaleString(), "Views"]}
              labelFormatter={(label) => label}
            />
            <Bar dataKey="views" fill="hsl(0, 65%, 50%)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
