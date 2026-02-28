"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default function MontagePage() {
  const [worksheets, setWorksheets] = useState<CategoryWorksheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    fetch("/api/montage")
      .then((r) => r.json())
      .then((data) => {
        setWorksheets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const copyTimestamps = useCallback(
    (worksheet: CategoryWorksheet) => {
      const lines = worksheet.clips.map(
        (c, i) =>
          `${i + 1}. ${c.videoTitle} (${c.speakers.join(", ")})\n` +
          `   ${c.startTimestamp} - ${c.endTimestamp} (${c.durationSeconds}s)\n` +
          `   ${c.youtubeUrl}\n` +
          `   ${c.description || ""}`
      );
      const text = `${worksheet.category.name}\n${"=".repeat(40)}\n\n${lines.join("\n\n")}`;
      navigator.clipboard.writeText(text);
    },
    []
  );

  const copyAllTimestamps = useCallback(() => {
    const sections = filtered.map((ws) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading montage data...</p>
      </div>
    );
  }

  if (worksheets.length === 0) {
    return (
      <div className="py-10">
        <Link href="/categories" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
          &larr; Categories
        </Link>
        <h1 className="text-3xl font-bold mb-4">Montage Worksheets</h1>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground mb-2">No clips identified yet.</p>
            <p className="text-sm text-muted-foreground">
              Run the pipeline to identify clips:{" "}
              <code className="bg-muted px-2 py-1 rounded text-xs">
                python scripts/tedx_pipeline.py run-all
              </code>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filtered =
    selectedCategory === "all"
      ? worksheets.filter((ws) => ws.clips.length > 0)
      : worksheets.filter((ws) => ws.category.slug === selectedCategory);

  const totalClips = filtered.reduce((sum, ws) => sum + ws.clips.length, 0);

  return (
    <div className="py-6 print:py-2">
      <div className="flex items-center justify-between mb-6 print:mb-2">
        <div>
          <Link href="/categories" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block print:hidden">
            &larr; Categories
          </Link>
          <h1 className="text-3xl font-bold print:text-xl">Montage Worksheets</h1>
          <p className="text-muted-foreground mt-1 print:text-xs">
            {totalClips} clips across {filtered.length} categories
          </p>
        </div>
        <div className="flex items-center gap-3 print:hidden">
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
          <Button variant="outline" onClick={copyAllTimestamps}>
            Copy All Timestamps
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      {filtered.map((ws) => (
        <Card key={ws.category.slug} className="mb-6 print:mb-4 print:break-inside-avoid">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl print:text-base">
                {ws.category.name}
              </CardTitle>
              <div className="flex items-center gap-2 print:hidden">
                <Badge variant="secondary">{ws.clips.length} clips</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyTimestamps(ws)}
                >
                  Copy
                </Button>
              </div>
            </div>
            {ws.category.description && (
              <p className="text-sm text-muted-foreground print:text-xs">
                {ws.category.description}
              </p>
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
                    <TableCell className="text-sm font-medium max-w-48 truncate">
                      {clip.videoTitle}
                    </TableCell>
                    <TableCell className="text-sm">
                      {clip.speakers.join(", ") || "-"}
                    </TableCell>
                    <TableCell className="text-sm font-mono whitespace-nowrap">
                      {clip.startTimestamp} - {clip.endTimestamp}
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {clip.durationSeconds}s
                    </TableCell>
                    <TableCell className="print:hidden">
                      <a
                        href={clip.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-600 hover:underline text-sm"
                      >
                        Watch
                      </a>
                    </TableCell>
                    <TableCell className="text-xs max-w-64">
                      {clip.description && (
                        <p className="mb-1">{clip.description}</p>
                      )}
                      {clip.quoteSnippet && (
                        <p className="italic text-muted-foreground">
                          &ldquo;{clip.quoteSnippet}&rdquo;
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
