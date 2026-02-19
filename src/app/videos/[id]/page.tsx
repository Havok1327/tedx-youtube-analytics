"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface VideoDetail {
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
  history: { id: number; views: number; likes: number; recordedAt: string }[];
  ageInDays: number | null;
  viewsPerDay: number | null;
}

interface EventOption {
  id: number;
  name: string;
}

export default function VideoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [togglingExclude, setTogglingExclude] = useState(false);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [editEventId, setEditEventId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchVideo = () => {
    if (params.id) {
      fetch(`/api/videos/${params.id}`)
        .then((r) => {
          if (!r.ok) throw new Error("Failed to fetch");
          return r.json();
        })
        .then(setVideo)
        .catch(() => setVideo(null))
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    fetchVideo();
  }, [params.id]);

  const openEditDialog = async () => {
    setEditError(null);
    setEditEventId(video?.eventId?.toString() || "");
    setEditOpen(true);

    try {
      const res = await fetch("/api/events");
      if (res.ok) setEvents(await res.json());
    } catch {
      setEditError("Failed to load events");
    }
  };

  const handleSave = async () => {
    if (!video) return;
    setSaving(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: editEventId && editEventId !== "none" ? parseInt(editEventId) : null,
        }),
      });
      if (res.ok) {
        setEditOpen(false);
        fetchVideo();
      } else {
        const data = await res.json();
        setEditError(data.error || "Save failed");
      }
    } catch {
      setEditError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleExclude = async () => {
    if (!video) return;
    setTogglingExclude(true);
    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludeFromCharts: video.excludeFromCharts ? 0 : 1 }),
      });
      if (res.ok) fetchVideo();
    } finally {
      setTogglingExclude(false);
    }
  };

  const handleDelete = async () => {
    if (!video || !confirm(`Delete "${video.title || "this video"}"? This cannot be undone.`)) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/videos/${video.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/videos");
      } else {
        const data = await res.json();
        setEditError(data.error || "Delete failed");
      }
    } catch {
      setEditError("Failed to delete video");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading video...</div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Video not found</p>
        <Link href="/videos" className="text-primary underline">
          Back to videos
        </Link>
      </div>
    );
  }

  const speakerNames = video.speakers
    .map((s) => `${s.firstName} ${s.lastName}`.trim())
    .join(", ") || "Unknown Speaker";

  const historyData = [...video.history]
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .map((h) => ({
      ...h,
      displayDate: new Date(h.recordedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "2-digit",
      }),
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/videos">
          <Button variant="ghost" size="sm">
            &larr; Back
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{video.title || "Untitled Video"}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-muted-foreground">{speakerNames}</span>
          {video.eventName && (
            <Badge variant="secondary">{video.eventName}</Badge>
          )}
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            Edit
          </Button>
          <Button
            variant={video.excludeFromCharts ? "secondary" : "ghost"}
            size="sm"
            onClick={handleToggleExclude}
            disabled={togglingExclude}
          >
            {video.excludeFromCharts ? "Include in Charts" : "Exclude from Charts"}
          </Button>
        </div>
      </div>

      <div className="aspect-video w-full max-w-3xl rounded-lg overflow-hidden border">
        <iframe
          src={`https://www.youtube.com/embed/${video.youtubeId}`}
          title={video.title || "YouTube Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(video.views || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Likes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(video.likes || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Views/Day</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{video.viewsPerDay?.toFixed(1) || "\u2014"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Age (Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{video.ageInDays?.toLocaleString() || "\u2014"}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View History</CardTitle>
        </CardHeader>
        <CardContent>
          {historyData.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No history data available for this video.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={historyData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()
                  }
                />
                <Tooltip
                  formatter={(value) => [Number(value).toLocaleString(), "Views"]}
                  labelFormatter={(label) => label}
                />
                <Line
                  type="monotone"
                  dataKey="views"
                  stroke="hsl(0, 65%, 50%)"
                  strokeWidth={2}
                  dot={historyData.length < 30}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Published</span>
            <span>
              {video.publishedAt
                ? new Date(video.publishedAt).toLocaleDateString()
                : "Unknown"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Updated</span>
            <span>{video.lastUpdated || "Never"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">YouTube ID</span>
            <span className="font-mono">{video.youtubeId}</span>
          </div>
          {video.url && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">URL</span>
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline truncate max-w-[300px]"
              >
                {video.url}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Video</DialogTitle>
            <DialogDescription>Change the event assignment for this video.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Event</Label>
              <Select value={editEventId} onValueChange={setEditEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No event</SelectItem>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editError && <p className="text-sm text-destructive">{editError}</p>}

            <div className="flex justify-between">
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
