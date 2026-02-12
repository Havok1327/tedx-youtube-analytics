// Server-only YouTube API helper
import "server-only";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  return key;
}

export function extractVideoId(url: string): string | null {
  if (!url) return null;
  // Fix common typos
  let cleaned = url.trim().replace(/^h+ttps?:\/\//, "https://");

  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // bare video ID
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) return match[1];
  }
  return null;
}

interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  publishedAt: string;
  views: number;
  likes: number;
}

export async function fetchVideoInfo(videoId: string): Promise<YouTubeVideoInfo | null> {
  const key = getApiKey();
  const url = `${YOUTUBE_API_BASE}/videos?part=snippet,statistics&id=${videoId}&key=${key}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`YouTube API error: ${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  if (!data.items || data.items.length === 0) return null;

  const item = data.items[0];
  return {
    videoId: item.id,
    title: item.snippet.title,
    publishedAt: item.snippet.publishedAt,
    views: parseInt(item.statistics.viewCount || "0", 10),
    likes: parseInt(item.statistics.likeCount || "0", 10),
  };
}

export async function fetchMultipleVideos(videoIds: string[]): Promise<Map<string, YouTubeVideoInfo>> {
  const key = getApiKey();
  const results = new Map<string, YouTubeVideoInfo>();

  // YouTube API allows up to 50 IDs per request
  const batchSize = 50;
  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize);
    const ids = batch.join(",");
    const url = `${YOUTUBE_API_BASE}/videos?part=snippet,statistics&id=${ids}&key=${key}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`YouTube API error for batch starting at ${i}: ${res.status}`);
      continue;
    }

    const data = await res.json();
    for (const item of data.items || []) {
      results.set(item.id, {
        videoId: item.id,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        views: parseInt(item.statistics.viewCount || "0", 10),
        likes: parseInt(item.statistics.likeCount || "0", 10),
      });
    }
  }

  return results;
}
