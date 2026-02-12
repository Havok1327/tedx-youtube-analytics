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

interface EventComparisonChartProps {
  data: { eventName: string; avgViews: number; videoCount: number; totalViews: number }[];
}

export function EventComparisonChart({ data }: EventComparisonChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    shortName: d.eventName.length > 25 ? d.eventName.substring(0, 22) + "..." : d.eventName,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Average Views per Video by Event</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 80, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="shortName"
              tick={{ fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
            <Tooltip
              formatter={(value) => [Number(value).toLocaleString(), "Avg Views"]}
              labelFormatter={(label) => label}
            />
            <Bar dataKey="avgViews" fill="hsl(220, 65%, 50%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
