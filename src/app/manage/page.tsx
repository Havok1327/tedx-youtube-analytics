"use client";

import { useEffect, useState } from "react";
import { VideoForm } from "@/components/video-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatSpeakerName } from "@/lib/speaker-name";

interface Event {
  id: number;
  name: string;
}

interface Speaker {
  id: number;
  firstName: string;
  lastName: string;
}

interface VideoItem {
  id: number;
  title: string | null;
  eventName: string | null;
  speakers: { id: number; firstName: string; lastName: string }[];
}

export default function ManagePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [videoSearch, setVideoSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // New event form
  const [newEventName, setNewEventName] = useState("");
  const [addingEvent, setAddingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editingEventName, setEditingEventName] = useState("");
  const [eventSpeakers, setEventSpeakers] = useState<{ id: number; firstName: string; lastName: string; videos: string[] }[]>([]);
  const [loadingEventSpeakers, setLoadingEventSpeakers] = useState(false);

  // New speaker form
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [addingSpeaker, setAddingSpeaker] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);
  const [editingSpeakerFirst, setEditingSpeakerFirst] = useState("");
  const [editingSpeakerLast, setEditingSpeakerLast] = useState("");
  const [speakerSearch, setSpeakerSearch] = useState("");

  // Transcripts
  const [transcriptStats, setTranscriptStats] = useState<{
    totalVideos: number;
    totalTranscripts: number;
  } | null>(null);
  const [fetchingTranscripts, setFetchingTranscripts] = useState(false);
  const [transcriptResult, setTranscriptResult] = useState<string | null>(null);
  const [transcriptErrors, setTranscriptErrors] = useState<string[]>([]);

  // Pipeline status
  const [pipelineStats, setPipelineStats] = useState<{
    categories: number;
    tagged: number;
    clips: number;
  } | null>(null);

  // Refresh
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);

  // Cron status
  const [cronEnabled, setCronEnabled] = useState(true);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [lastRefreshInfo, setLastRefreshInfo] = useState<string | null>(null);
  const [togglingCron, setTogglingCron] = useState(false);

  // Squarespace HTML export
  const [generatingSqs, setGeneratingSqs] = useState(false);
  const [sqsHtml, setSqsHtml] = useState<string | null>(null);
  const [sqsCount, setSqsCount] = useState<number | null>(null);
  const [sqsSectionCount, setSqsSectionCount] = useState<number | null>(null);
  const [sqsBytes, setSqsBytes] = useState<number | null>(null);
  const [sqsDialogOpen, setSqsDialogOpen] = useState(false);
  const [sqsError, setSqsError] = useState<string | null>(null);
  const [sqsCopied, setSqsCopied] = useState(false);

  const handleGenerateSquarespace = async () => {
    setGeneratingSqs(true);
    setSqsError(null);
    setSqsCopied(false);
    try {
      const res = await fetch("/api/export/squarespace");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setSqsError(err.error || `Server returned ${res.status}`);
        setSqsDialogOpen(true);
        return;
      }
      const data = await res.json();
      setSqsHtml(data.html);
      setSqsCount(data.videoCount);
      setSqsSectionCount(data.sectionCount ?? null);
      setSqsBytes(data.byteSize);
      setSqsDialogOpen(true);
    } catch (e) {
      setSqsError(String(e));
      setSqsDialogOpen(true);
    } finally {
      setGeneratingSqs(false);
    }
  };

  const handleCopySqsHtml = async () => {
    if (!sqsHtml) return;
    try {
      await navigator.clipboard.writeText(sqsHtml);
      setSqsCopied(true);
      setTimeout(() => setSqsCopied(false), 2500);
    } catch {
      // Clipboard API can fail in non-secure contexts — fall back to select-all
      const ta = document.getElementById("sqs-html-textarea") as HTMLTextAreaElement | null;
      if (ta) {
        ta.select();
        document.execCommand("copy");
        setSqsCopied(true);
        setTimeout(() => setSqsCopied(false), 2500);
      }
    }
  };

  const handleDownloadSqsHtml = () => {
    if (!sqsHtml) return;
    const blob = new Blob([sqsHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tedxstl-squarespace-grid-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const settings = await res.json();
      if (settings.cron_enabled !== undefined) {
        setCronEnabled(settings.cron_enabled !== "false");
      }
      if (settings.last_refresh_at) {
        setLastRefreshAt(settings.last_refresh_at);
      }
      if (settings.last_refresh_result) {
        try {
          const info = JSON.parse(settings.last_refresh_result);
          if (info.error) {
            setLastRefreshInfo(`Failed (${info.trigger}): ${info.error}`);
          } else {
            setLastRefreshInfo(`${info.trigger === "cron" ? "Auto" : "Manual"}: updated ${info.updated}/${info.total} videos, ${info.historyAdded} history entries${info.errorCount ? `, ${info.errorCount} errors` : ""}`);
          }
        } catch {
          setLastRefreshInfo(null);
        }
      }
    } catch {
      // ignore
    }
  };

  const toggleCron = async () => {
    setTogglingCron(true);
    const newValue = !cronEnabled;
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "cron_enabled", value: newValue ? "true" : "false" }),
      });
      if (res.ok) setCronEnabled(newValue);
    } finally {
      setTogglingCron(false);
    }
  };

  const fetchData = async () => {
    try {
      const [evtsRes, spksRes, vidsRes] = await Promise.all([
        fetch("/api/events"),
        fetch("/api/speakers"),
        fetch("/api/videos?includeExcluded=true"),
      ]);
      if (!evtsRes.ok || !spksRes.ok) {
        console.error("API error:", evtsRes.status, spksRes.status);
        setEvents([]);
        setSpeakers([]);
        return;
      }
      const [evts, spks, vids] = await Promise.all([evtsRes.json(), spksRes.json(), vidsRes.ok ? vidsRes.json() : []]);
      setEvents(Array.isArray(evts) ? evts : []);
      setSpeakers(Array.isArray(spks) ? spks : []);
      setVideos(Array.isArray(vids) ? vids : []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setEvents([]);
      setSpeakers([]);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideo = async (id: number, title: string | null) => {
    if (!confirm(`Delete "${title || "this video"}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete video");
      }
    } catch {
      alert("Failed to delete video");
    }
  };

  const fetchTranscriptStats = async () => {
    try {
      const res = await fetch("/api/transcripts");
      if (!res.ok) return;
      const data = await res.json();
      setTranscriptStats({
        totalVideos: data.totalVideos,
        totalTranscripts: data.totalTranscripts,
      });
    } catch {
      // ignore
    }
  };

  const fetchPipelineStats = async () => {
    try {
      const [catRes, clipRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/clips"),
      ]);
      const cats = catRes.ok ? await catRes.json() : [];
      const clips = clipRes.ok ? await clipRes.json() : [];
      const totalTagged = Array.isArray(cats)
        ? cats.reduce((sum: number, c: { videoCount: number }) => sum + c.videoCount, 0)
        : 0;
      setPipelineStats({
        categories: Array.isArray(cats) ? cats.length : 0,
        tagged: totalTagged,
        clips: Array.isArray(clips) ? clips.length : 0,
      });
    } catch {
      // ignore
    }
  };

  const handleFetchTranscripts = async () => {
    setFetchingTranscripts(true);
    setTranscriptResult(null);
    setTranscriptErrors([]);
    try {
      const res = await fetch("/api/transcripts/fetch", { method: "POST" });
      const result = await res.json();
      if (res.ok) {
        if (result.fetched === 0 && result.failed === 0) {
          setTranscriptResult(result.message || "All transcripts already fetched.");
        } else {
          setTranscriptResult(
            `Fetched ${result.fetched}/${result.total}. ${result.failed} failed.`
          );
        }
        if (result.errors && result.errors.length > 0) {
          setTranscriptErrors(result.errors);
        }
      } else {
        setTranscriptResult(`Error: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      setTranscriptResult(`Error: ${error}`);
    } finally {
      setFetchingTranscripts(false);
      fetchTranscriptStats();
    }
  };

  useEffect(() => {
    fetchData();
    fetchSettings();
    fetchTranscriptStats();
    fetchPipelineStats();
  }, []);

  const handleAddEvent = async () => {
    if (!newEventName.trim()) return;
    setAddingEvent(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newEventName }),
      });
      if (res.ok) {
        setNewEventName("");
        fetchData();
      }
    } finally {
      setAddingEvent(false);
    }
  };

  const handleEditEvent = async () => {
    if (!editingEvent || !editingEventName.trim()) return;
    try {
      const res = await fetch(`/api/events/${editingEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingEventName }),
      });
      if (res.ok) {
        setEditingEvent(null);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to update event:", error);
    }
  };

  const handleDeleteEvent = async (id: number, name: string) => {
    if (!confirm(`Delete event "${name}"?`)) return;
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete event");
      }
    } catch (error) {
      console.error("Failed to delete event:", error);
    }
  };

  const handleAddSpeaker = async () => {
    if (!newFirstName.trim() && !newLastName.trim()) return;
    setAddingSpeaker(true);
    try {
      const res = await fetch("/api/speakers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: newFirstName, lastName: newLastName }),
      });
      if (res.ok) {
        setNewFirstName("");
        setNewLastName("");
        fetchData();
      }
    } finally {
      setAddingSpeaker(false);
    }
  };

  const handleEditSpeaker = async () => {
    if (!editingSpeaker) return;
    if (!editingSpeakerFirst.trim() && !editingSpeakerLast.trim()) return;
    try {
      const res = await fetch(`/api/speakers/${editingSpeaker.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: editingSpeakerFirst, lastName: editingSpeakerLast }),
      });
      if (res.ok) {
        setEditingSpeaker(null);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to update speaker:", error);
    }
  };

  const handleDeleteSpeaker = async (id: number, name: string) => {
    if (!confirm(`Delete speaker "${name}"?`)) return;
    try {
      const res = await fetch(`/api/speakers/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete speaker");
      }
    } catch (error) {
      console.error("Failed to delete speaker:", error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const result = await res.json();
      if (res.ok) {
        setRefreshResult(
          `Updated ${result.updated}/${result.total} videos. ${result.historyAdded} history entries. ${result.errors.length} errors.`
        );
      } else {
        setRefreshResult(`Error: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      setRefreshResult(`Error: ${error}`);
    } finally {
      setRefreshing(false);
      fetchSettings();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage</h1>

      <Tabs defaultValue="pipeline" className="w-full">
        <TabsList>
          <TabsTrigger value="pipeline">Data & Pipeline</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="entities">Events & Speakers</TabsTrigger>
        </TabsList>

        {/* ── Data & Pipeline Tab ──────────────────────────────── */}
        <TabsContent value="pipeline" className="space-y-6">
          {/* Refresh Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Refresh YouTube Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Fetch latest view counts and likes from YouTube for all videos. This also creates a new history snapshot. Use sparingly — YouTube limits API calls to 10,000 quota units per day.
              </p>
              <div className="flex items-center gap-3">
                <Button onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? "Refreshing..." : "Refresh All Stats"}
                </Button>
                {refreshResult && (
                  <span className={`text-sm ${refreshResult.startsWith("Error") ? "text-destructive" : "text-green-600"}`}>
                    {refreshResult}
                  </span>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Scheduled Auto-Refresh</p>
                    <p className="text-xs text-muted-foreground">Runs every Wednesday at 8:00 AM UTC (3:00 AM Central)</p>
                  </div>
                  <Button
                    variant={cronEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={toggleCron}
                    disabled={togglingCron}
                  >
                    {togglingCron ? "..." : cronEnabled ? "Enabled" : "Disabled"}
                  </Button>
                </div>
                {lastRefreshAt && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      Last refresh: {new Date(lastRefreshAt).toLocaleString()}
                    </p>
                    {lastRefreshInfo && (
                      <p className="text-xs">{lastRefreshInfo}</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transcripts */}
          <Card>
            <CardHeader>
              <CardTitle>Video Transcripts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Fetch YouTube transcripts for all videos. Transcripts are used for AI categorization and clip finding.
              </p>
              {transcriptStats && (
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <span className="font-medium">{transcriptStats.totalTranscripts}</span>
                    <span className="text-muted-foreground">/{transcriptStats.totalVideos} transcripts fetched</span>
                  </div>
                  {transcriptStats.totalTranscripts < transcriptStats.totalVideos && (
                    <span className="text-xs text-amber-600 font-medium">
                      {transcriptStats.totalVideos - transcriptStats.totalTranscripts} missing
                    </span>
                  )}
                  {transcriptStats.totalTranscripts === transcriptStats.totalVideos && (
                    <span className="text-xs text-green-600 font-medium">All done</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3">
                <Button onClick={handleFetchTranscripts} disabled={fetchingTranscripts}>
                  {fetchingTranscripts ? "Fetching Transcripts..." : "Fetch Missing Transcripts"}
                </Button>
                {transcriptResult && (
                  <span className={`text-sm ${transcriptResult.startsWith("Error") ? "text-destructive" : "text-green-600"}`}>
                    {transcriptResult}
                  </span>
                )}
              </div>
              {fetchingTranscripts && (
                <p className="text-xs text-muted-foreground">
                  This may take a few minutes for many videos. Do not close this page.
                </p>
              )}
              {transcriptErrors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-1">
                  <p className="text-sm font-medium text-destructive">Failed videos:</p>
                  {transcriptErrors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive/80 font-mono">{err}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Categorization Pipeline */}
          <Card>
            <CardHeader>
              <CardTitle>AI Categorization & Clips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                AI-powered categorization and clip identification. This must be run locally by an admin using the command line (requires Claude CLI).
              </p>
              {pipelineStats && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{pipelineStats.categories}</p>
                    <p className="text-xs text-muted-foreground">Categories</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{pipelineStats.tagged}</p>
                    <p className="text-xs text-muted-foreground">Videos Tagged</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{pipelineStats.clips}</p>
                    <p className="text-xs text-muted-foreground">Clips Found</p>
                  </div>
                </div>
              )}
              {pipelineStats && pipelineStats.categories === 0 && (
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium">To run the AI pipeline:</p>
                  <code className="block text-xs bg-background p-2 rounded border">
                    cd D:\Coding\TEDx_Youtube_analytics<br />
                    python scripts/tedx_pipeline.py phase2 &nbsp;&nbsp;# Categorize<br />
                    python scripts/tedx_pipeline.py phase3 &nbsp;&nbsp;# Find clips
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Contact your admin to run these commands. Requires Claude CLI to be installed locally.
                  </p>
                </div>
              )}
              {pipelineStats && pipelineStats.categories > 0 && (
                <div className="flex gap-3">
                  <Button variant="outline" asChild>
                    <a href="/categories">View Categories</a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/montage">Montage Worksheets</a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Exports */}
          <Card>
            <CardHeader>
              <CardTitle>Export Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Download data as CSV files for use in spreadsheets.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" asChild>
                  <a href="/api/export/history" download>Export View History</a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/api/export/speakers" download>Export Speaker Summary</a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Squarespace HTML Export */}
          <Card>
            <CardHeader>
              <CardTitle>Squarespace Video Grid</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Generate a self-contained HTML video grid you can paste into a Squarespace Code Block. Every non-excluded video in the tracker, grouped by event (newest events first), with an inline lightbox player so visitors never leave Squarespace. Re-generate whenever you add or remove videos.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleGenerateSquarespace} disabled={generatingSqs}>
                  {generatingSqs ? "Generating..." : "Generate Squarespace HTML"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Re-generate any time you add new videos — Squarespace just needs a fresh paste.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Videos Tab ───────────────────────────────────────── */}
        <TabsContent value="videos" className="space-y-6">
          <VideoForm events={events} speakers={speakers} onSuccess={fetchData} />
          <Card>
            <CardHeader>
              <CardTitle>Remove a Video ({videos.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Search by title, speaker, or event..."
                value={videoSearch}
                onChange={(e) => setVideoSearch(e.target.value)}
                className="max-w-sm"
              />
              <div className="max-h-80 overflow-y-auto space-y-1 rounded-md border p-2">
                {videos
                  .filter((v) => {
                    if (!videoSearch.trim()) return true;
                    const q = videoSearch.toLowerCase();
                    const speakerNames = v.speakers.map((s) => formatSpeakerName(s)).join(" ");
                    return (
                      v.title?.toLowerCase().includes(q) ||
                      v.eventName?.toLowerCase().includes(q) ||
                      speakerNames.toLowerCase().includes(q)
                    );
                  })
                  .map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-accent">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{v.title || "Untitled"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {v.speakers.map((s) => formatSpeakerName(s)).join(", ") || "No speaker"}
                          {v.eventName ? ` · ${v.eventName}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteVideo(v.id, v.title)}
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Events & Speakers Tab ────────────────────────────── */}
        <TabsContent value="entities" className="space-y-6">
          {/* Manage Events */}
          <Card>
            <CardHeader>
              <CardTitle>Events ({events.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="New event name..."
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  className="max-w-sm"
                />
                <Button onClick={handleAddEvent} disabled={addingEvent || !newEventName.trim()}>
                  Add Event
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {events.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={async () => {
                      setEditingEvent(e);
                      setEditingEventName(e.name);
                      setLoadingEventSpeakers(true);
                      setEventSpeakers([]);
                      try {
                        const res = await fetch(`/api/events/${e.id}`);
                        if (res.ok) {
                          const data = await res.json();
                          setEventSpeakers(data.speakers || []);
                        }
                      } finally {
                        setLoadingEventSpeakers(false);
                      }
                    }}
                    className="px-3 py-1 text-sm rounded-full bg-accent text-accent-foreground hover:bg-accent/70 transition-colors cursor-pointer"
                  >
                    {e.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Edit Event Dialog */}
          {editingEvent && (
            <Dialog open onOpenChange={(open) => { if (!open) setEditingEvent(null); }}>
              <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:!max-w-2xl overflow-hidden">
                <DialogHeader>
                  <DialogTitle>Edit Event</DialogTitle>
                  <DialogDescription>Update the event name or remove it.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Event Name</Label>
                    <Input
                      value={editingEventName}
                      onChange={(e) => setEditingEventName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleEditEvent(); }}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Speakers ({eventSpeakers.length})</Label>
                    {loadingEventSpeakers ? (
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    ) : eventSpeakers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No speakers linked to this event</p>
                    ) : (
                      <div className="max-h-[200px] overflow-y-auto rounded-md border p-2 space-y-2 min-w-0">
                        {eventSpeakers.map((s) => (
                          <div key={s.id} className="text-sm min-w-0">
                            <span className="font-medium">{formatSpeakerName(s)}</span>
                            {s.videos.length > 0 && (
                              <p className="text-xs text-muted-foreground truncate max-w-full">
                                {s.videos.join("; ")}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <Button
                      variant="destructive"
                      onClick={() => {
                        handleDeleteEvent(editingEvent.id, editingEvent.name);
                        setEditingEvent(null);
                      }}
                    >
                      Delete
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setEditingEvent(null)}>Cancel</Button>
                      <Button onClick={handleEditEvent} disabled={!editingEventName.trim()}>Save</Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Manage Speakers */}
          <Card>
            <CardHeader>
              <CardTitle>Speakers ({speakers.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="First name"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  className="max-w-[200px]"
                />
                <Input
                  placeholder="Last name"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  className="max-w-[200px]"
                />
                <Button onClick={handleAddSpeaker} disabled={addingSpeaker || (!newFirstName.trim() && !newLastName.trim())}>
                  Add Speaker
                </Button>
              </div>
              <Input
                placeholder="Search speakers..."
                value={speakerSearch}
                onChange={(e) => setSpeakerSearch(e.target.value)}
                className="max-w-xs"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 max-h-[300px] overflow-y-auto">
                {speakers
                  .filter((s) => {
                    if (!speakerSearch.trim()) return true;
                    const q = speakerSearch.toLowerCase();
                    return s.firstName.toLowerCase().includes(q) || s.lastName.toLowerCase().includes(q);
                  })
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setEditingSpeaker(s);
                        setEditingSpeakerFirst(s.firstName);
                        setEditingSpeakerLast(s.lastName);
                      }}
                      className="text-sm px-2 py-1.5 text-left rounded-md hover:bg-accent transition-colors truncate"
                    >
                      {formatSpeakerName(s)}
                    </button>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Edit Speaker Dialog */}
          {editingSpeaker && (
            <Dialog open onOpenChange={(open) => { if (!open) setEditingSpeaker(null); }}>
              <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>Edit Speaker</DialogTitle>
                  <DialogDescription>Update the speaker&apos;s name or remove them.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={editingSpeakerFirst}
                      onChange={(e) => setEditingSpeakerFirst(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={editingSpeakerLast}
                      onChange={(e) => setEditingSpeakerLast(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleEditSpeaker(); }}
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex justify-between">
                    <Button
                      variant="destructive"
                      onClick={() => {
                        handleDeleteSpeaker(editingSpeaker.id, formatSpeakerName(editingSpeaker));
                        setEditingSpeaker(null);
                      }}
                    >
                      Delete
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setEditingSpeaker(null)}>Cancel</Button>
                      <Button onClick={handleEditSpeaker} disabled={!editingSpeakerFirst.trim() && !editingSpeakerLast.trim()}>Save</Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>
      </Tabs>

      {/* Squarespace HTML Export Dialog */}
      <Dialog open={sqsDialogOpen} onOpenChange={setSqsDialogOpen}>
        <DialogContent className="sm:!max-w-3xl">
          <DialogHeader>
            <DialogTitle>Squarespace HTML</DialogTitle>
            <DialogDescription>
              {sqsError
                ? "Something went wrong generating the HTML."
                : sqsCount != null
                  ? `${sqsCount} videos across ${sqsSectionCount ?? "?"} events${sqsBytes ? ` · ${(sqsBytes / 1024).toFixed(1)} KB` : ""}. Paste this into a Squarespace Code Block on a full-width section.`
                  : "Generating..."}
            </DialogDescription>
          </DialogHeader>

          {sqsError ? (
            <p className="text-sm text-destructive">{sqsError}</p>
          ) : sqsHtml ? (
            <div className="space-y-3">
              <textarea
                id="sqs-html-textarea"
                readOnly
                value={sqsHtml}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full h-64 rounded-md border bg-muted/30 p-2 font-mono text-xs"
                spellCheck={false}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleCopySqsHtml} size="sm">
                  {sqsCopied ? "Copied!" : "Copy to Clipboard"}
                </Button>
                <Button onClick={handleDownloadSqsHtml} variant="outline" size="sm">
                  Download as .html
                </Button>
                <p className="text-xs text-muted-foreground ml-auto">
                  Tip: click inside the box to select all.
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
