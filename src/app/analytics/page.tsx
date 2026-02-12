"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "hsl(0, 65%, 50%)", "hsl(220, 65%, 50%)", "hsl(120, 50%, 40%)",
  "hsl(280, 60%, 50%)", "hsl(30, 80%, 50%)", "hsl(180, 60%, 40%)",
  "hsl(340, 70%, 50%)", "hsl(60, 70%, 40%)", "hsl(200, 70%, 45%)",
  "hsl(150, 60%, 40%)", "hsl(10, 70%, 55%)", "hsl(250, 55%, 55%)",
  "hsl(90, 55%, 40%)",
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Event Trends ───────────────────────────────────────
function EventTrends() {
  const [data, setData] = useState<{ chartData: Record<string, string | number>[]; eventNames: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats/events").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted-foreground py-8 text-center">Loading event trends...</p>;
  if (!data || data.chartData.length === 0) return <p className="text-muted-foreground py-8 text-center">No history data available</p>;

  const chartData = data.chartData.map((d) => ({ ...d, displayDate: formatDate(d.date as string) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Views by Event Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={450}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
            <Tooltip formatter={(value) => [Number(value).toLocaleString(), ""]} labelFormatter={(l) => l} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {data.eventNames.map((name, i) => (
              <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Speaker Deep Dive ──────────────────────────────────
interface SpeakerOption { id: number; firstName: string; lastName: string; videoCount: number }

function SpeakerDeepDive() {
  const [speakerList, setSpeakerList] = useState<SpeakerOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [speakerData, setSpeakerData] = useState<{
    speaker: { firstName: string; lastName: string };
    videos: { videoId: number; title: string; views: number }[];
    chartData: Record<string, string | number>[];
    videoNames: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/stats/speakers").then((r) => r.json()).then(setSpeakerList);
  }, []);

  const filteredSpeakers = useMemo(() => {
    if (!search.trim()) return speakerList;
    const q = search.toLowerCase();
    return speakerList.filter((s) =>
      s.firstName.toLowerCase().includes(q) || s.lastName.toLowerCase().includes(q)
    );
  }, [speakerList, search]);

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    setLoading(true);
    setSpeakerData(null);
    try {
      const res = await fetch(`/api/stats/speakers?speakerId=${id}`);
      if (res.ok) setSpeakerData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const chartData = speakerData?.chartData.map((d) => ({
    ...d,
    displayDate: formatDate(d.date as string),
  })) || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Speaker Deep Dive</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Search speakers..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={selectedId} onValueChange={handleSelect}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Select a speaker..." />
            </SelectTrigger>
            <SelectContent>
              {filteredSpeakers.map((s) => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.firstName} {s.lastName} ({s.videoCount} video{s.videoCount !== 1 ? "s" : ""})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading && <p className="text-muted-foreground text-center py-8">Loading speaker data...</p>}

      {speakerData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{speakerData.speaker.firstName} {speakerData.speaker.lastName} — View History</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No history data for this speaker</p>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                    <Tooltip formatter={(value) => [Number(value).toLocaleString(), ""]} labelFormatter={(l) => l} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {speakerData.videoNames.map((name, i) => (
                      <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Videos</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {speakerData.videos.map((v) => (
                  <div key={v.videoId} className="flex justify-between items-center text-sm">
                    <a href={`/videos/${v.videoId}`} className="hover:underline truncate flex-1 mr-4">{v.title || "Untitled"}</a>
                    <span className="text-muted-foreground shrink-0">{(v.views || 0).toLocaleString()} views</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Video Comparison ───────────────────────────────────
function VideoComparison() {
  const [allVideos, setAllVideos] = useState<{ id: number; title: string; views: number; speakers: { firstName: string; lastName: string }[] }[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [compData, setCompData] = useState<{ chartData: Record<string, string | number>[]; videoNames: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/videos").then((r) => r.json()).then(setAllVideos);
  }, []);

  const filteredVideos = useMemo(() => {
    if (!search.trim()) return allVideos.slice(0, 50);
    const q = search.toLowerCase();
    return allVideos.filter((v) =>
      (v.title || "").toLowerCase().includes(q) ||
      v.speakers?.some((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [allVideos, search]);

  const toggleVideo = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const handleCompare = async () => {
    if (selected.length < 2) return;
    setLoading(true);
    setCompData(null);
    try {
      const res = await fetch(`/api/stats/compare?ids=${selected.join(",")}`);
      if (res.ok) setCompData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const chartData = compData?.chartData.map((d) => ({
    ...d,
    displayDate: formatDate(d.date as string),
  })) || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Compare Videos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Select 2-5 videos to overlay their view growth.</p>
          <Input placeholder="Search videos..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <div className="max-h-[250px] overflow-y-auto border rounded-md p-2 space-y-1">
            {filteredVideos.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => toggleVideo(v.id)}
                className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors flex justify-between items-center ${
                  selected.includes(v.id) ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                <span className="truncate flex-1 mr-2">
                  {v.speakers?.map((s) => `${s.firstName} ${s.lastName}`).join(", ") || "Unknown"}: {v.title || "Untitled"}
                </span>
                <span className="shrink-0 text-xs">{(v.views || 0).toLocaleString()}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleCompare} disabled={loading || selected.length < 2}>
              {loading ? "Loading..." : `Compare (${selected.length})`}
            </Button>
            {selected.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => { setSelected([]); setCompData(null); }}>Clear</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {compData && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>View Growth Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Tooltip formatter={(value) => [Number(value).toLocaleString(), ""]} labelFormatter={(l) => l} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {compData.videoNames.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Period Reports ─────────────────────────────────────
interface PeriodVideo {
  id: number; title: string; speaker: string; event: string;
  currentViews: number; weekGain: number | null; monthGain: number | null;
  weekGainPct: number | null; monthGainPct: number | null;
}

function PeriodReports() {
  const [data, setData] = useState<{ latestDate: string; weekAgoDate: string; monthAgoDate: string; videos: PeriodVideo[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"weekGain" | "monthGain" | "weekGainPct" | "monthGainPct">("weekGain");

  useEffect(() => {
    fetch("/api/stats/period").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted-foreground py-8 text-center">Loading period reports...</p>;
  if (!data || data.videos.length === 0) return <p className="text-muted-foreground py-8 text-center">Not enough history data for period comparison</p>;

  const sorted = [...data.videos].sort((a, b) => {
    const aVal = a[sortBy] || 0;
    const bVal = b[sortBy] || 0;
    return bVal - aVal;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Period Report</CardTitle>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>Latest: {formatDate(data.latestDate)}</span>
            <span>vs Week: {formatDate(data.weekAgoDate)}</span>
            <span>vs Month: {formatDate(data.monthAgoDate)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          {(
            [
              ["weekGain", "Week +Views"],
              ["monthGain", "Month +Views"],
              ["weekGainPct", "Week +%"],
              ["monthGainPct", "Month +%"],
            ] as const
          ).map(([key, label]) => (
            <Button key={key} size="sm" variant={sortBy === key ? "default" : "outline"} onClick={() => setSortBy(key)}>
              {label}
            </Button>
          ))}
        </div>
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Speaker</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Week +</TableHead>
                <TableHead className="text-right">Month +</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.slice(0, 30).map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="text-sm font-medium">{v.speaker}</TableCell>
                  <TableCell className="text-sm max-w-[250px] truncate">
                    <a href={`/videos/${v.id}`} className="hover:underline">{v.title}</a>
                  </TableCell>
                  <TableCell className="text-right">{v.currentViews.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {v.weekGain !== null ? (
                      <span className={v.weekGain > 0 ? "text-green-600" : ""}>
                        +{v.weekGain.toLocaleString()}
                        {v.weekGainPct !== null && (
                          <span className="text-xs text-muted-foreground ml-1">({v.weekGainPct}%)</span>
                        )}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {v.monthGain !== null ? (
                      <span className={v.monthGain > 0 ? "text-green-600" : ""}>
                        +{v.monthGain.toLocaleString()}
                        {v.monthGainPct !== null && (
                          <span className="text-xs text-muted-foreground ml-1">({v.monthGainPct}%)</span>
                        )}
                      </span>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────
export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analytics</h1>
      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Event Trends</TabsTrigger>
          <TabsTrigger value="speakers">Speaker Deep Dive</TabsTrigger>
          <TabsTrigger value="compare">Compare Videos</TabsTrigger>
          <TabsTrigger value="periods">Period Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="events" className="mt-4">
          <EventTrends />
        </TabsContent>
        <TabsContent value="speakers" className="mt-4">
          <SpeakerDeepDive />
        </TabsContent>
        <TabsContent value="compare" className="mt-4">
          <VideoComparison />
        </TabsContent>
        <TabsContent value="periods" className="mt-4">
          <PeriodReports />
        </TabsContent>
      </Tabs>
    </div>
  );
}
