"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        onClick={toggle}
        className="ml-2 inline-flex items-center justify-center size-5 rounded-full border text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        aria-label="Info"
      >
        i
      </button>
      {open && (
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {text}
        </span>
      )}
    </span>
  );
}

// ─── DateRangePicker (shared) ────────────────────────────
function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const today = new Date().toISOString().split("T")[0];

  const presets: [string, string, string][] = [
    ["All Time", "", ""],
    ["Last 3 Mo", new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0], today],
    ["Last 6 Mo", new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0], today],
    ["Last Year", new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0], today],
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map(([label, f, t]) => (
        <Button
          key={label}
          size="sm"
          variant={from === f && to === t ? "default" : "outline"}
          onClick={() => onChange(f, t)}
        >
          {label}
        </Button>
      ))}
      <input
        type="date"
        value={from}
        onChange={(e) => onChange(e.target.value, to)}
        className="h-8 rounded-md border px-2 text-sm"
      />
      <span className="text-muted-foreground text-sm">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onChange(from, e.target.value)}
        className="h-8 rounded-md border px-2 text-sm"
      />
    </div>
  );
}

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
function EventTrends({ includeExcluded }: { includeExcluded: boolean }) {
  const [data, setData] = useState<{ chartData: Record<string, string | number>[]; eventNames: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = includeExcluded ? "/api/stats/events?includeExcluded=true" : "/api/stats/events";
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [includeExcluded]);

  if (loading) return <p className="text-muted-foreground py-8 text-center">Loading event trends...</p>;
  if (!data || data.chartData.length === 0) return <p className="text-muted-foreground py-8 text-center">No trend data yet. This chart builds up over time as the weekly refresh creates snapshots. Run a manual refresh to add a data point.</p>;

  const chartData = data.chartData.map((d) => ({ ...d, displayDate: formatDate(d.date as string) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Views by Event Over Time<InfoTip text="Tracks how total views for each event grow over time. Each line represents one event, summing views across all its videos. Builds up as refresh snapshots accumulate." /></CardTitle>
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

// ─── Event Scorecard ────────────────────────────────────
interface EventScore {
  name: string;
  videoCount: number;
  totalViews: number;
  totalLikes: number;
  avgViews: number;
  avgEngagement: number;
  bestVideo: string;
  bestVideoViews: number;
}

function EventScorecard({ includeExcluded }: { includeExcluded: boolean }) {
  const [data, setData] = useState<EventScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"totalViews" | "videoCount" | "avgViews" | "avgEngagement">("totalViews");

  useEffect(() => {
    setLoading(true);
    const url = includeExcluded ? "/api/videos?includeExcluded=true" : "/api/videos";
    fetch(url)
      .then((r) => r.json())
      .then((videos: { views: number | null; likes: number | null; title: string | null; eventName: string | null }[]) => {
        const eventMap = new Map<string, { videoCount: number; totalViews: number; totalLikes: number; bestVideo: string; bestVideoViews: number }>();

        for (const v of videos) {
          const name = v.eventName || "Unassigned";
          const views = v.views || 0;
          const likes = v.likes || 0;
          const existing = eventMap.get(name) || { videoCount: 0, totalViews: 0, totalLikes: 0, bestVideo: "", bestVideoViews: 0 };
          existing.videoCount++;
          existing.totalViews += views;
          existing.totalLikes += likes;
          if (views > existing.bestVideoViews) {
            existing.bestVideoViews = views;
            existing.bestVideo = v.title || "Untitled";
          }
          eventMap.set(name, existing);
        }

        const result: EventScore[] = Array.from(eventMap.entries()).map(([name, stats]) => ({
          name,
          videoCount: stats.videoCount,
          totalViews: stats.totalViews,
          totalLikes: stats.totalLikes,
          avgViews: Math.round(stats.totalViews / stats.videoCount),
          avgEngagement: stats.totalViews > 0 ? Math.round((stats.totalLikes / stats.totalViews) * 1000) / 10 : 0,
          bestVideo: stats.bestVideo,
          bestVideoViews: stats.bestVideoViews,
        }));

        setData(result);
      })
      .finally(() => setLoading(false));
  }, [includeExcluded]);

  if (loading) return <p className="text-muted-foreground py-8 text-center">Loading event scorecard...</p>;
  if (data.length === 0) return <p className="text-muted-foreground py-8 text-center">No event data available</p>;

  const sorted = [...data].sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Scorecard<InfoTip text="Summary stats for each TEDx event: total views, average views per video, engagement rate (likes/views), and the best-performing video from each event." /></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          {(
            [
              ["totalViews", "Total Views"],
              ["avgViews", "Avg Views/Video"],
              ["videoCount", "Video Count"],
              ["avgEngagement", "Engagement %"],
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
                <TableHead>Event</TableHead>
                <TableHead className="text-right">Videos</TableHead>
                <TableHead className="text-right">Total Views</TableHead>
                <TableHead className="text-right">Total Likes</TableHead>
                <TableHead className="text-right">Avg Views/Video</TableHead>
                <TableHead className="text-right">Eng %</TableHead>
                <TableHead className="max-w-[200px]">Best Performer</TableHead>
                <TableHead className="text-right">Its Views</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((e) => (
                <TableRow key={e.name}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-right">{e.videoCount}</TableCell>
                  <TableCell className="text-right">{e.totalViews.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{e.totalLikes.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{e.avgViews.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{e.avgEngagement}%</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate text-muted-foreground">{e.bestVideo}</TableCell>
                  <TableCell className="text-right">{e.bestVideoViews.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
  const [chartFrom, setChartFrom] = useState("");
  const [chartTo, setChartTo] = useState("");

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

  const chartData = useMemo(() => {
    if (!speakerData?.chartData) return [];
    return speakerData.chartData
      .filter((d) => {
        const date = d.date as string;
        if (chartFrom && date < chartFrom) return false;
        if (chartTo && date > chartTo) return false;
        return true;
      })
      .map((d) => ({
        ...d,
        displayDate: formatDate(d.date as string),
      }));
  }, [speakerData, chartFrom, chartTo]);

  const handleChartDateChange = (from: string, to: string) => {
    setChartFrom(from);
    setChartTo(to);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Speaker Deep Dive<InfoTip text="Select a speaker to see their individual video performance over time. Shows a view history chart for each of their talks and a video list." /></CardTitle>
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
            <CardHeader className="space-y-3">
              <CardTitle>{speakerData.speaker.firstName} {speakerData.speaker.lastName} — View History</CardTitle>
              <DateRangePicker from={chartFrom} to={chartTo} onChange={handleChartDateChange} />
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
function VideoComparison({ includeExcluded }: { includeExcluded: boolean }) {
  const [allVideos, setAllVideos] = useState<{ id: number; title: string; views: number; eventName: string | null; speakers: { firstName: string; lastName: string }[] }[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [compData, setCompData] = useState<{ chartData: Record<string, string | number>[]; videoNames: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");

  useEffect(() => {
    const url = includeExcluded ? "/api/videos?includeExcluded=true" : "/api/videos";
    fetch(url).then((r) => r.json()).then(setAllVideos);
  }, [includeExcluded]);

  const eventNames = useMemo(() => {
    const names = new Set<string>();
    for (const v of allVideos) {
      if (v.eventName) names.add(v.eventName);
    }
    return Array.from(names).sort();
  }, [allVideos]);

  const filteredVideos = useMemo(() => {
    let vids = allVideos;
    if (eventFilter !== "all") {
      vids = vids.filter((v) => v.eventName === eventFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      vids = vids.filter((v) =>
        (v.title || "").toLowerCase().includes(q) ||
        v.speakers?.some((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q))
      );
    }
    return vids.slice(0, 50);
  }, [allVideos, search, eventFilter]);

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
          <CardTitle>Compare Videos<InfoTip text="Select 2-5 videos to overlay their view growth on one chart. Useful for comparing how different talks perform over the same time period." /></CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Select 2-5 videos to overlay their view growth.</p>
          <div className="flex gap-2 items-center">
            <Input placeholder="Search videos..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="max-w-[200px]">
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {eventNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

function PeriodReports({ includeExcluded }: { includeExcluded: boolean }) {
  const [data, setData] = useState<{ latestDate: string; weekAgoDate: string; monthAgoDate: string; videos: PeriodVideo[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"weekGain" | "monthGain" | "weekGainPct" | "monthGainPct">("weekGain");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchData = useCallback((from: string, to: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (includeExcluded) params.set("includeExcluded", "true");
    const qs = params.toString();
    fetch(`/api/stats/period${qs ? `?${qs}` : ""}`)
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [includeExcluded]);

  useEffect(() => {
    fetchData(dateFrom, dateTo);
  }, [dateFrom, dateTo, fetchData]);

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  if (loading) return <p className="text-muted-foreground py-8 text-center">Loading period reports...</p>;
  if (!data || data.videos.length === 0) return <p className="text-muted-foreground py-8 text-center">Not enough history data for period comparison</p>;

  const sorted = [...data.videos].sort((a, b) => {
    const aVal = a[sortBy] || 0;
    const bVal = b[sortBy] || 0;
    return bVal - aVal;
  });

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle>Period Report<InfoTip text="Shows view gains for each video over the past week and month. Sort by absolute gains or percentage growth to find trending and rising videos." /></CardTitle>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>Latest: {formatDate(data.latestDate)}</span>
            <span>vs Week: {formatDate(data.weekAgoDate)}</span>
            <span>vs Month: {formatDate(data.monthAgoDate)}</span>
          </div>
        </div>
        <DateRangePicker from={dateFrom} to={dateTo} onChange={handleDateChange} />
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

// ─── Speaker Leaderboard ────────────────────────────────
interface LeaderboardSpeaker {
  name: string;
  videoCount: number;
  totalViews: number;
  totalLikes: number;
  avgViewsPerDay: number;
  topVideo: string;
}

function SpeakerLeaderboard({ includeExcluded }: { includeExcluded: boolean }) {
  const [data, setData] = useState<LeaderboardSpeaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"totalViews" | "videoCount" | "avgViewsPerDay" | "totalLikes">("totalViews");

  useEffect(() => {
    setLoading(true);
    const url = includeExcluded ? "/api/videos?includeExcluded=true" : "/api/videos";
    fetch(url)
      .then((r) => r.json())
      .then((videos: { views: number | null; likes: number | null; title: string | null; publishedAt: string | null; speakers: { firstName: string; lastName: string }[] }[]) => {
        const speakerMap = new Map<string, { videoCount: number; totalViews: number; totalLikes: number; totalVpd: number; topVideo: string; topViews: number }>();

        for (const v of videos) {
          const views = v.views || 0;
          const likes = v.likes || 0;
          const ageDays = v.publishedAt ? Math.max(1, Math.floor((Date.now() - new Date(v.publishedAt).getTime()) / 86400000)) : null;
          const vpd = ageDays ? views / ageDays : 0;

          for (const s of v.speakers) {
            const name = `${s.firstName} ${s.lastName}`.trim();
            const existing = speakerMap.get(name) || { videoCount: 0, totalViews: 0, totalLikes: 0, totalVpd: 0, topVideo: "", topViews: 0 };
            existing.videoCount++;
            existing.totalViews += views;
            existing.totalLikes += likes;
            existing.totalVpd += vpd;
            if (views > existing.topViews) {
              existing.topViews = views;
              existing.topVideo = v.title || "Untitled";
            }
            speakerMap.set(name, existing);
          }
        }

        const result: LeaderboardSpeaker[] = Array.from(speakerMap.entries()).map(([name, stats]) => ({
          name,
          videoCount: stats.videoCount,
          totalViews: stats.totalViews,
          totalLikes: stats.totalLikes,
          avgViewsPerDay: Math.round(stats.totalVpd * 10) / 10,
          topVideo: stats.topVideo,
        }));

        setData(result);
      })
      .finally(() => setLoading(false));
  }, [includeExcluded]);

  if (loading) return <p className="text-muted-foreground py-8 text-center">Loading speaker leaderboard...</p>;
  if (data.length === 0) return <p className="text-muted-foreground py-8 text-center">No speaker data available</p>;

  const sorted = [...data].sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Speaker Leaderboard<InfoTip text="Ranks all speakers by their total reach across all videos. Sort by total views, likes, video count, or average daily views to see who's driving the most engagement." /></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          {(
            [
              ["totalViews", "Total Views"],
              ["totalLikes", "Total Likes"],
              ["videoCount", "Video Count"],
              ["avgViewsPerDay", "Avg Views/Day"],
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
                <TableHead className="w-8">#</TableHead>
                <TableHead>Speaker</TableHead>
                <TableHead className="text-right">Videos</TableHead>
                <TableHead className="text-right">Total Views</TableHead>
                <TableHead className="text-right">Total Likes</TableHead>
                <TableHead className="text-right">Avg Views/Day</TableHead>
                <TableHead className="max-w-[200px]">Top Video</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((s, i) => (
                <TableRow key={s.name}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-right">{s.videoCount}</TableCell>
                  <TableCell className="text-right">{s.totalViews.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{s.totalLikes.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{s.avgViewsPerDay.toFixed(1)}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate text-muted-foreground">{s.topVideo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Views by Publish Year ──────────────────────────────
function ViewsByYear({ includeExcluded }: { includeExcluded: boolean }) {
  const [data, setData] = useState<{ year: string; totalViews: number; totalLikes: number; videoCount: number; avgViews: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = includeExcluded ? "/api/videos?includeExcluded=true" : "/api/videos";
    fetch(url)
      .then((r) => r.json())
      .then((videos: { views: number | null; likes: number | null; publishedAt: string | null }[]) => {
        const yearMap = new Map<string, { totalViews: number; totalLikes: number; videoCount: number }>();

        for (const v of videos) {
          const year = v.publishedAt ? new Date(v.publishedAt).getFullYear().toString() : "Unknown";
          const existing = yearMap.get(year) || { totalViews: 0, totalLikes: 0, videoCount: 0 };
          existing.totalViews += v.views || 0;
          existing.totalLikes += v.likes || 0;
          existing.videoCount++;
          yearMap.set(year, existing);
        }

        const result = Array.from(yearMap.entries())
          .filter(([y]) => y !== "Unknown")
          .map(([year, stats]) => ({
            year,
            totalViews: stats.totalViews,
            totalLikes: stats.totalLikes,
            videoCount: stats.videoCount,
            avgViews: Math.round(stats.totalViews / stats.videoCount),
          }))
          .sort((a, b) => a.year.localeCompare(b.year));

        setData(result);
      })
      .finally(() => setLoading(false));
  }, [includeExcluded]);

  if (loading) return <p className="text-muted-foreground py-8 text-center">Loading views by year...</p>;
  if (data.length === 0) return <p className="text-muted-foreground py-8 text-center">No data available</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Total Views by Publish Year<InfoTip text="Groups all videos by the year they were published on YouTube. Shows whether newer events are gaining more traction than older ones, and how average performance per video changes over the years." /></CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
              <Tooltip formatter={(value) => [Number(value).toLocaleString(), ""]} />
              <Bar dataKey="totalViews" name="Total Views" fill="hsl(0, 65%, 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Average Views per Video by Year</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
              <Tooltip formatter={(value) => [Number(value).toLocaleString(), ""]} />
              <Bar dataKey="avgViews" name="Avg Views/Video" fill="hsl(220, 65%, 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Year Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Videos</TableHead>
                  <TableHead className="text-right">Total Views</TableHead>
                  <TableHead className="text-right">Total Likes</TableHead>
                  <TableHead className="text-right">Avg Views/Video</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((d) => (
                  <TableRow key={d.year}>
                    <TableCell className="font-medium">{d.year}</TableCell>
                    <TableCell className="text-right">{d.videoCount}</TableCell>
                    <TableCell className="text-right">{d.totalViews.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{d.totalLikes.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{d.avgViews.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Weekly Report ──────────────────────────────────────
interface WeeklyRow {
  date: string;
  videoId: number;
  title: string;
  speaker: string;
  event: string;
  totalViews: number;
  weeklyGain: number | null;
}

function WeeklyReport() {
  const [rawData, setRawData] = useState<WeeklyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats/weekly")
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then(setRawData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group by Sun–Sat calendar week, compute gain from consecutive week totals
  const weeks = useMemo(() => {
    const byWeek = new Map<string, { rows: WeeklyRow[]; weekEnd: string }>();

    for (const r of rawData) {
      const d = new Date(r.date + "T00:00:00");
      const sunday = new Date(d);
      sunday.setDate(d.getDate() - d.getDay());
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      const weekKey = sunday.toISOString().split("T")[0];
      const weekEnd = saturday.toISOString().split("T")[0];

      const existing = byWeek.get(weekKey) || { rows: [], weekEnd };
      existing.rows.push(r);
      byWeek.set(weekKey, existing);
    }

    const result = [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, { rows, weekEnd }]) => {
        // Sum each video's highest view count seen this week
        const maxByVideo = new Map<number, number>();
        for (const r of rows) {
          maxByVideo.set(r.videoId, Math.max(maxByVideo.get(r.videoId) ?? 0, r.totalViews));
        }
        const totalViews = [...maxByVideo.values()].reduce((a, b) => a + b, 0);
        return { weekStart, weekEnd, totalViews, weeklyGain: null as number | null };
      });

    // Gain = difference of consecutive week totals (avoids null first-snapshot issues)
    for (let i = 1; i < result.length; i++) {
      result[i].weeklyGain = result[i].totalViews - result[i - 1].totalViews;
    }

    return result;
  }, [rawData]);

  const exportCsv = useCallback(() => {
    const headers = ["Week Start", "Week End", "Views Gained", "Total Views"];
    const rows = [...weeks].reverse().map((w) => [
      w.weekStart, w.weekEnd, w.weeklyGain !== null ? w.weeklyGain.toString() : "", w.totalViews.toString(),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tedx-weekly-views-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [weeks]);

  if (loading) return <p className="text-muted-foreground py-8 text-center">Loading weekly report...</p>;
  if (rawData.length === 0) return <p className="text-muted-foreground py-8 text-center">No snapshot history yet. Run a refresh to start collecting weekly data.</p>;

  const chartData = weeks.map((w) => ({
    ...w,
    displayWeek: new Date(w.weekStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{weeks.length} weeks of data</span>
        <Button size="sm" variant="outline" onClick={exportCsv}>Export CSV</Button>
      </div>

      {/* Weekly gains bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Views Gained — All Videos</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="displayWeek" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
              <Tooltip
                formatter={(v) => [Number(v).toLocaleString(), "Views Gained"]}
                labelFormatter={(l) => `Week of ${l}`}
              />
              <Bar dataKey="weeklyGain" name="Views Gained" fill="hsl(0, 65%, 50%)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Data table — newest first */}
      <Card>
        <CardHeader><CardTitle>Weekly Data</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week (Sun – Sat)</TableHead>
                  <TableHead className="text-right">Views Gained</TableHead>
                  <TableHead className="text-right">Total Views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...weeks].reverse().map((w) => (
                  <TableRow key={w.weekStart}>
                    <TableCell className="text-sm">
                      {new Date(w.weekStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {" – "}
                      {new Date(w.weekEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {w.weeklyGain !== null && w.weeklyGain > 0
                        ? <span className="text-green-600">+{w.weeklyGain.toLocaleString()}</span>
                        : w.weeklyGain === 0
                          ? <span className="text-muted-foreground">+0</span>
                          : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {w.totalViews.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────
export default function AnalyticsPage() {
  const [includeExcluded, setIncludeExcluded] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeExcluded}
            onChange={(e) => setIncludeExcluded(e.target.checked)}
            className="h-4 w-4"
          />
          Show excluded videos
        </label>
      </div>
      <Tabs defaultValue="scorecard">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="scorecard">Event Scorecard</TabsTrigger>
          <TabsTrigger value="leaderboard">Speaker Leaderboard</TabsTrigger>
          <TabsTrigger value="speakers">Speaker Deep Dive</TabsTrigger>
          <TabsTrigger value="compare">Compare Videos</TabsTrigger>
          <TabsTrigger value="periods">Period Reports</TabsTrigger>
          <TabsTrigger value="yearly">Views by Year</TabsTrigger>
          <TabsTrigger value="events">Event Trends</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Report</TabsTrigger>
        </TabsList>
        <TabsContent value="scorecard" className="mt-4">
          <EventScorecard includeExcluded={includeExcluded} />
        </TabsContent>
        <TabsContent value="leaderboard" className="mt-4">
          <SpeakerLeaderboard includeExcluded={includeExcluded} />
        </TabsContent>
        <TabsContent value="speakers" className="mt-4">
          <SpeakerDeepDive />
        </TabsContent>
        <TabsContent value="compare" className="mt-4">
          <VideoComparison includeExcluded={includeExcluded} />
        </TabsContent>
        <TabsContent value="periods" className="mt-4">
          <PeriodReports includeExcluded={includeExcluded} />
        </TabsContent>
        <TabsContent value="yearly" className="mt-4">
          <ViewsByYear includeExcluded={includeExcluded} />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <EventTrends includeExcluded={includeExcluded} />
        </TabsContent>
        <TabsContent value="weekly" className="mt-4">
          <WeeklyReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
