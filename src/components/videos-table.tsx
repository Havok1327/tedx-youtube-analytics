"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface Video {
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
  speakers: { id: number; firstName: string; lastName: string }[];
  ageInDays: number | null;
  viewsPerDay: number | null;
}

type SortField = "title" | "views" | "likes" | "viewsPerDay" | "publishedAt" | "lastUpdated" | "speakers" | "eventName";
type SortDirection = "asc" | "desc";

interface VideosTableProps {
  videos: Video[];
  events: { id: number; name: string }[];
}

export function VideosTable({ videos, events }: VideosTableProps) {
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("views");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return "";
    return sortDirection === "asc" ? " \u2191" : " \u2193";
  };

  const filtered = useMemo(() => {
    let result = videos;

    if (eventFilter !== "all") {
      result = result.filter((v) => v.eventName === eventFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          (v.title || "").toLowerCase().includes(q) ||
          v.speakers.some(
            (s) =>
              s.firstName.toLowerCase().includes(q) ||
              s.lastName.toLowerCase().includes(q)
          )
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = (a.title || "").localeCompare(b.title || "");
          break;
        case "views":
          cmp = (a.views || 0) - (b.views || 0);
          break;
        case "likes":
          cmp = (a.likes || 0) - (b.likes || 0);
          break;
        case "viewsPerDay":
          cmp = (a.viewsPerDay || 0) - (b.viewsPerDay || 0);
          break;
        case "publishedAt":
          cmp = (a.publishedAt || "").localeCompare(b.publishedAt || "");
          break;
        case "lastUpdated":
          cmp = (a.lastUpdated || "").localeCompare(b.lastUpdated || "");
          break;
        case "speakers":
          cmp = (a.speakers[0]?.lastName || "").localeCompare(b.speakers[0]?.lastName || "");
          break;
        case "eventName":
          cmp = (a.eventName || "").localeCompare(b.eventName || "");
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [videos, search, eventFilter, sortField, sortDirection]);

  const speakerNames = (v: Video) =>
    v.speakers.map((s) => `${s.firstName} ${s.lastName}`.trim()).join(", ") || "Unknown";

  const exportCsv = useCallback(() => {
    const escapeField = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const headers = ["Speaker(s)", "Event", "Title", "Views", "Likes", "Views/Day", "Published", "YouTube URL"];
    const rows = filtered.map((v) => [
      escapeField(speakerNames(v)),
      escapeField(v.eventName || ""),
      escapeField(v.title || "Untitled"),
      (v.views || 0).toString(),
      (v.likes || 0).toString(),
      v.viewsPerDay?.toFixed(1) || "",
      v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : "",
      v.url || `https://www.youtube.com/watch?v=${v.youtubeId}`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tedx-videos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search speakers or titles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="sm:max-w-[250px]">
            <SelectValue placeholder="All Events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {events.map((e) => (
              <SelectItem key={e.id} value={e.name}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center">
          {filtered.length} video{filtered.length !== 1 ? "s" : ""}
        </span>
        <Button variant="outline" size="sm" onClick={exportCsv} className="sm:ml-auto">
          Export CSV
        </Button>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-accent/50 select-none"
                onClick={() => toggleSort("speakers")}
              >
                Speaker(s){sortIndicator("speakers")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-accent/50 select-none"
                onClick={() => toggleSort("eventName")}
              >
                Event{sortIndicator("eventName")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-accent/50 select-none min-w-[200px]"
                onClick={() => toggleSort("title")}
              >
                Title{sortIndicator("title")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-accent/50 select-none text-right"
                onClick={() => toggleSort("views")}
              >
                Views{sortIndicator("views")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-accent/50 select-none text-right"
                onClick={() => toggleSort("likes")}
              >
                Likes{sortIndicator("likes")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-accent/50 select-none text-right"
                onClick={() => toggleSort("viewsPerDay")}
              >
                Views/Day{sortIndicator("viewsPerDay")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-accent/50 select-none"
                onClick={() => toggleSort("publishedAt")}
              >
                Published{sortIndicator("publishedAt")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No videos found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((video) => (
                <TableRow key={video.id} className="hover:bg-accent/30">
                  <TableCell className="font-medium">
                    <Link href={`/videos/${video.id}`} className="hover:underline">
                      {speakerNames(video)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{video.eventName || "\u2014"}</TableCell>
                  <TableCell className="text-sm max-w-[300px] truncate">
                    <Link href={`/videos/${video.id}`} className="hover:underline">
                      {video.title || "Untitled"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{(video.views || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{(video.likes || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{video.viewsPerDay?.toFixed(1) || "\u2014"}</TableCell>
                  <TableCell className="text-sm">
                    {video.publishedAt
                      ? new Date(video.publishedAt).toLocaleDateString()
                      : "\u2014"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
