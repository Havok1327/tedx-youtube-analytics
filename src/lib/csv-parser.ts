// CSV parsing utilities for importing spreadsheet data
import Papa from "papaparse";

export interface TrackingRow {
  lastName: string;
  firstName: string;
  event: string;
  url: string;
  videoId: string;
  title: string;
  views: number;
  likes: number;
  publishedAt: string;
  lastUpdated: string;
  notes: string;
}

export interface HistoryRow {
  date: string;
  videoId: string;
  title: string;
  views: number;
  likes: number;
  event: string;
  simpleDate: string;
}

export function parseTrackingCSV(csvText: string): TrackingRow[] {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  return (result.data as Record<string, string>[])
    .map((row) => ({
      lastName: (row["Last Name"] || "").trim(),
      firstName: (row["First Name"] || "").trim(),
      event: (row["Event"] || "").trim(),
      url: (row["URL"] || "").trim(),
      videoId: (row["Video ID"] || "").trim(),
      title: (row["Title"] || "").trim(),
      views: parseInt(row["Views"] || "0", 10) || 0,
      likes: parseInt(row["Likes"] || "0", 10) || 0,
      publishedAt: (row["Published At"] || "").trim(),
      lastUpdated: (row["Last Updated"] || "").trim(),
      notes: (row["Notes"] || "").trim(),
    }))
    .filter((row) => row.videoId); // Skip rows without video IDs
}

export function parseHistoryCSV(csvText: string): HistoryRow[] {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  return (result.data as Record<string, string>[])
    .map((row) => ({
      date: (row["Date"] || "").trim(),
      videoId: (row["Video ID"] || "").trim(),
      title: (row["Title"] || "").trim(),
      views: parseInt(row["Views"] || "0", 10) || 0,
      likes: parseInt(row["Likes"] || "0", 10) || 0,
      event: (row["Event"] || "").trim(),
      simpleDate: (row["Simple Date"] || "").trim(),
    }))
    .filter((row) => row.videoId && row.date); // Skip rows without video IDs or dates
}
