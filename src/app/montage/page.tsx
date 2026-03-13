"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import Link from "next/link";

interface Clip {
  clipId: number;
  videoId: number;
  youtubeId: string;
  videoTitle: string | null;
  startTime: number;
  endTime: number;
  startTimestamp: string;
  endTimestamp: string;
  durationSeconds: number;
  description: string | null;
  quoteSnippet: string | null;
  relevanceScore: number | null;
  youtubeUrl: string;
  speakers: string[];
}

interface CategoryWorksheet {
  category: {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    relatedThemes: string[];
  };
  clips: Clip[];
}

interface KeyMoment {
  momentId: number;
  quoteText: string;
  context: string | null;
  startTime: number;
  endTime: number;
  startTimestamp: string;
  endTimestamp: string;
  durationSeconds: number;
  youtubeUrl: string;
}

interface KeyMomentVideo {
  videoId: number;
  youtubeId: string;
  videoTitle: string | null;
  speakers: string[];
  moments: KeyMoment[];
}

export default function MontagePage() {
  const [worksheets, setWorksheets] = useState<CategoryWorksheet[]>([]);
  const [keyMomentVideos, setKeyMomentVideos] = useState<KeyMomentVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [speakerFilter, setSpeakerFilter] = useState("all");

  useEffect(() => {
    fetch("/api/montage")
      .then((r) => r.json())
      .then((data) => {
        setWorksheets(data.worksheets || []);
        setKeyMomentVideos(data.keyMomentVideos || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const copyTimestamps = useCallback((worksheet: CategoryWorksheet) => {
    const lines = worksheet.clips.map(
      (c, i) =>
        `${i + 1}. ${c.videoTitle} (${c.speakers.join(", ")})\n` +
        `   ${c.startTimestamp} - ${c.endTimestamp} (${c.durationSeconds}s)\n` +
        `   ${c.youtubeUrl}\n` +
        `   ${c.description || ""}`
    );
    const text = `${worksheet.category.name}\n${"=".repeat(40)}\n\n${lines.join("\n\n")}`;
    navigator.clipboard.writeText(text);
  }, []);

  const copyAllClipTimestamps = useCallback(() => {
    const sections = filteredWorksheets.map((ws) => {
      const lines = ws.clips.map(
        (c, i) =>
          `${i + 1}. ${c.videoTitle} (${c.speakers.join(", ")})\n` +
          `   ${c.startTimestamp} - ${c.endTimestamp} (${c.durationSeconds}s)\n` +
          `   ${c.youtubeUrl}\n` +
          `   ${c.description || ""}`
      );
      return `${ws.category.name}\n${"=".repeat(40)}\n\n${lines.join("\n\n")}`;
    });
    navigator.clipboard.writeText(sections.join("\n\n\n"));
  }, [worksheets, selectedCategory]);

  const copyVideoMoments = useCallback((v: KeyMomentVideo) => {
    const lines = v.moments.map(
      (m, i) =>
        `${i + 1}. ${m.startTimestamp} - ${m.endTimestamp} (${m.durationSeconds}s)\n` +
        `   "${m.quoteText}"\n` +
        `   ${m.context || ""}\n` +
        `   ${m.youtubeUrl}`
    );
    const text = `${v.videoTitle} (${v.speakers.join(", ")})\n${"=".repeat(40)}\n\n${lines.join("\n\n")}`;
    navigator.clipboard.writeText(text);
  }, []);

  const copyAllMoments = useCallback(() => {
    const sections = filteredKeyMomentVideos.map((v) => {
      const lines = v.moments.map(
        (m, i) =>
          `${i + 1}. ${m.startTimestamp} - ${m.endTimestamp} (${m.durationSeconds}s)\n` +
          `   "${m.quoteText}"\n` +
          `   ${m.context || ""}\n` +
          `   ${m.youtubeUrl}`
      );
      return `${v.videoTitle} (${v.speakers.join(", ")})\n${"=".repeat(40)}\n\n${lines.join("\n\n")}`;
    });
    navigator.clipboard.writeText(sections.join("\n\n\n"));
  }, [keyMomentVideos, speakerFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading montage data...</p>
      </div>
    );
  }

  const filteredWorksheets =
    selectedCategory === "all"
      ? worksheets.filter((ws) => ws.clips.length > 0)
      : worksheets.filter((ws) => ws.category.slug === selectedCategory);

  const totalClips = filteredWorksheets.reduce((sum, ws) => sum + ws.clips.length, 0);

  // Build unique speaker list for key moments filter
  const allSpeakers = Array.from(
    new Set(keyMomentVideos.flatMap((v) => v.speakers))
  ).sort();

  const filteredKeyMomentVideos =
    speakerFilter === "all"
      ? keyMomentVideos
      : keyMomentVideos.filter((v) => v.speakers.includes(speakerFilter));

  const totalMoments = filteredKeyMomentVideos.reduce((sum, v) => sum + v.moments.length, 0);

  return (
    <div className="py-6 print:py-2">
      <div className="mb-6 print:mb-2">
        <Link href="/categories" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block print:hidden">
          &larr; Categories
        </Link>
        <h1 className="text-3xl font-bold print:text-xl">Montage Worksheets</h1>
      </div>

      <Tabs defaultValue="clips" className="w-full">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <TabsList>
            <TabsTrigger value="clips">
              Category Clips ({worksheets.reduce((s, w) => s + w.clips.length, 0)})
            </TabsTrigger>
            <TabsTrigger value="moments">
              Key Moments ({keyMomentVideos.reduce((s, v) => s + v.moments.length, 0)})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Category Clips Tab ─────────────────────────────────── */}
        <TabsContent value="clips">
          <div className="flex items-center justify-between mb-4 print:hidden">
            <p className="text-sm text-muted-foreground">
              {totalClips} clips across {filteredWorksheets.length} categories
            </p>
            <div className="flex items-center gap-3">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {worksheets.map((ws) => (
                    <SelectItem key={ws.category.slug} value={ws.category.slug}>
                      {ws.category.name} ({ws.clips.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={copyAllClipTimestamps}>Copy All</Button>
              <Button variant="outline" onClick={() => window.print()}>Print</Button>
            </div>
          </div>

          {filteredWorksheets.map((ws) => (
            <Card key={ws.category.slug} className="mb-6 print:mb-4 print:break-inside-avoid">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl print:text-base">{ws.category.name}</CardTitle>
                  <div className="flex items-center gap-2 print:hidden">
                    <Badge variant="secondary">{ws.clips.length} clips</Badge>
                    <Button variant="ghost" size="sm" onClick={() => copyTimestamps(ws)}>Copy</Button>
                  </div>
                </div>
                {ws.category.description && (
                  <p className="text-sm text-muted-foreground print:text-xs">{ws.category.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Video</TableHead>
                      <TableHead>Speaker(s)</TableHead>
                      <TableHead>Timestamps</TableHead>
                      <TableHead className="w-16">Duration</TableHead>
                      <TableHead className="print:hidden">Link</TableHead>
                      <TableHead>Description / Quote</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ws.clips.map((clip, i) => (
                      <TableRow key={clip.clipId}>
                        <TableCell className="font-bold text-red-600">{i + 1}</TableCell>
                        <TableCell className="text-sm font-medium max-w-48 truncate">{clip.videoTitle}</TableCell>
                        <TableCell className="text-sm">{clip.speakers.join(", ") || "-"}</TableCell>
                        <TableCell className="text-sm font-mono whitespace-nowrap">
                          {clip.startTimestamp} - {clip.endTimestamp}
                        </TableCell>
                        <TableCell className="text-sm text-center">{clip.durationSeconds}s</TableCell>
                        <TableCell className="print:hidden">
                          <a href={clip.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline text-sm">
                            Watch
                          </a>
                        </TableCell>
                        <TableCell className="text-xs max-w-64">
                          {clip.description && <p className="mb-1">{clip.description}</p>}
                          {clip.quoteSnippet && (
                            <p className="italic text-muted-foreground">&ldquo;{clip.quoteSnippet}&rdquo;</p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Key Moments Tab ────────────────────────────────────── */}
        <TabsContent value="moments">
          <div className="flex items-center justify-between mb-4 print:hidden">
            <p className="text-sm text-muted-foreground">
              {totalMoments} moments across {filteredKeyMomentVideos.length} videos
            </p>
            <div className="flex items-center gap-3">
              <Select value={speakerFilter} onValueChange={setSpeakerFilter}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Filter by speaker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Speakers</SelectItem>
                  {allSpeakers.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={copyAllMoments}>Copy All</Button>
              <Button variant="outline" onClick={() => window.print()}>Print</Button>
            </div>
          </div>

          {filteredKeyMomentVideos.map((v) => (
            <Card key={v.videoId} className="mb-6 print:mb-4 print:break-inside-avoid">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg print:text-base">{v.videoTitle}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{v.speakers.join(", ")}</p>
                  </div>
                  <div className="flex items-center gap-2 print:hidden">
                    <Badge variant="secondary">{v.moments.length} moments</Badge>
                    <Button variant="ghost" size="sm" onClick={() => copyVideoMoments(v)}>Copy</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Timestamps</TableHead>
                      <TableHead className="w-16">Duration</TableHead>
                      <TableHead className="print:hidden">Link</TableHead>
                      <TableHead>Quote</TableHead>
                      <TableHead>Context</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {v.moments.map((m, i) => (
                      <TableRow key={m.momentId}>
                        <TableCell className="font-bold text-red-600">{i + 1}</TableCell>
                        <TableCell className="text-sm font-mono whitespace-nowrap">
                          {m.startTimestamp} - {m.endTimestamp}
                        </TableCell>
                        <TableCell className="text-sm text-center">{m.durationSeconds}s</TableCell>
                        <TableCell className="print:hidden">
                          <a href={m.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline text-sm">
                            Watch
                          </a>
                        </TableCell>
                        <TableCell className="text-xs max-w-72 italic text-muted-foreground">
                          &ldquo;{m.quoteText}&rdquo;
                        </TableCell>
                        <TableCell className="text-xs max-w-56 text-muted-foreground">
                          {m.context}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
