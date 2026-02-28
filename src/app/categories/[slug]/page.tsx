"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Video {
  videoId: number;
  youtubeId: string;
  title: string | null;
  views: number | null;
  publishedAt: string | null;
  eventName: string | null;
  isPrimary: number;
  relevanceScore: number | null;
  summary: string | null;
  themes: string[];
  tone: string | null;
  speakers: string[];
}

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

interface CategoryDetail {
  category: {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    relatedThemes: string[];
  };
  videos: Video[];
  clips: Clip[];
}

export default function CategoryDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<CategoryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/categories/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!data || !data.category) {
    return (
      <div className="py-10">
        <p className="text-muted-foreground">Category not found.</p>
        <Link href="/categories" className="text-red-600 hover:underline mt-2 inline-block">
          Back to Categories
        </Link>
      </div>
    );
  }

  const { category, videos, clips } = data;

  return (
    <div className="py-6">
      <Link href="/categories" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
        &larr; All Categories
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">{category.name}</h1>
        {category.description && (
          <p className="text-muted-foreground mt-2">{category.description}</p>
        )}
        <div className="flex flex-wrap gap-1 mt-3">
          {category.relatedThemes.map((theme) => (
            <Badge key={theme} variant="outline" className="text-xs">
              {theme}
            </Badge>
          ))}
        </div>
      </div>

      {/* Clips Section */}
      {clips.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Best Clips for Montage ({clips.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clips.map((clip, i) => (
                <div
                  key={clip.clipId}
                  className="border rounded-lg p-4 hover:border-red-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-sm font-bold text-red-600 mr-2">
                        #{i + 1}
                      </span>
                      <span className="font-medium">
                        {clip.videoTitle}
                      </span>
                      {clip.speakers.length > 0 && (
                        <span className="text-sm text-muted-foreground ml-2">
                          by {clip.speakers.join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {clip.startTimestamp} - {clip.endTimestamp}
                      </Badge>
                      <Badge variant="outline">
                        {clip.durationSeconds}s
                      </Badge>
                    </div>
                  </div>
                  {clip.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {clip.description}
                    </p>
                  )}
                  {clip.quoteSnippet && (
                    <blockquote className="text-sm italic border-l-2 border-red-300 pl-3 mb-2">
                      &ldquo;{clip.quoteSnippet}&rdquo;
                    </blockquote>
                  )}
                  <a
                    href={clip.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-red-600 hover:underline"
                  >
                    Watch on YouTube at {clip.startTimestamp} &rarr;
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Videos Table */}
      <Card>
        <CardHeader>
          <CardTitle>Videos in this Category ({videos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Speaker(s)</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Relevance</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos.map((v) => (
                <TableRow key={v.videoId}>
                  <TableCell>
                    <Link
                      href={`/videos/${v.videoId}`}
                      className="text-red-600 hover:underline"
                    >
                      {v.title || v.youtubeId}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.speakers.join(", ") || "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.eventName || "-"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {v.views?.toLocaleString() || "-"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {v.relevanceScore != null
                      ? `${Math.round(v.relevanceScore * 100)}%`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={v.isPrimary ? "default" : "outline"} className="text-xs">
                      {v.isPrimary ? "Primary" : "Secondary"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
