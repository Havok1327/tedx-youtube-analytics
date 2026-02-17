"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function CsvImport() {
  const [trackingFile, setTrackingFile] = useState<File | null>(null);
  const [historyFile, setHistoryFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const trackingRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!trackingFile && !historyFile) return;

    setImporting(true);
    setResult(null);

    const formData = new FormData();
    if (trackingFile) formData.append("tracking", trackingFile);
    if (historyFile) formData.append("history", historyFile);

    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        const parts = [];
        if (data.events) parts.push(`${data.events} events`);
        if (data.speakers) parts.push(`${data.speakers} speakers`);
        if (data.videos) parts.push(`${data.videos} videos`);
        if (data.history) parts.push(`${data.history} history rows`);
        if (data.errors?.length) parts.push(`${data.errors.length} errors`);
        setResult(`Imported: ${parts.join(", ")}`);
      } else {
        setResult(`Error: ${data.error || "Import failed"}${data.details ? ` — ${data.details}` : ""}`);
      }
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>CSV Import</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload the YouTube Tracking CSV and/or View History CSV to seed the database.
        </p>

        <div className="space-y-2">
          <Label>YouTube Tracking CSV</Label>
          <input
            ref={trackingRef}
            type="file"
            accept=".csv"
            onChange={(e) => setTrackingFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />
          {trackingFile && (
            <p className="text-xs text-muted-foreground">Selected: {trackingFile.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>View History CSV</Label>
          <input
            ref={historyRef}
            type="file"
            accept=".csv"
            onChange={(e) => setHistoryFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />
          {historyFile && (
            <p className="text-xs text-muted-foreground">Selected: {historyFile.name}</p>
          )}
        </div>

        <Button onClick={handleImport} disabled={importing || (!trackingFile && !historyFile)}>
          {importing ? "Importing..." : "Import CSVs"}
        </Button>

        {result && (
          <p className={`text-sm ${result.startsWith("Error") ? "text-destructive" : "text-green-600"}`}>
            {result}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
