"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Event {
  id: number;
  name: string;
}

interface Speaker {
  id: number;
  firstName: string;
  lastName: string;
}

interface VideoFormProps {
  events: Event[];
  speakers: Speaker[];
  onSuccess: () => void;
}

interface VideoPreview {
  videoId: string;
  title: string;
  publishedAt: string;
  views: number;
  likes: number;
}

export function VideoForm({ events, speakers, onSuccess }: VideoFormProps) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<VideoPreview | null>(null);
  const [eventId, setEventId] = useState<string>("");
  const [selectedSpeakers, setSelectedSpeakers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const res = await fetch("/api/youtube/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (res.ok) {
        setPreview(data);
      } else {
        setError(data.error || "Lookup failed");
      }
    } catch (e) {
      setError(`Error: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeId: preview.videoId,
          url,
          title: preview.title,
          publishedAt: preview.publishedAt,
          views: preview.views,
          likes: preview.likes,
          eventId: eventId ? parseInt(eventId) : null,
          speakerIds: selectedSpeakers.map((s) => parseInt(s)),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setUrl("");
        setPreview(null);
        setEventId("");
        setSelectedSpeakers([]);
        onSuccess();
      } else {
        setError(data.error || "Save failed");
      }
    } catch (e) {
      setError(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleSpeaker = (id: string) => {
    setSelectedSpeakers((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Video</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Paste a YouTube video URL below and click Lookup to fetch its details. Then assign it to an event and select the speaker(s) before saving. Events and speakers must be created first (see sections below) before they can be assigned to a video.
        </p>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label>YouTube URL</Label>
            <Input
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleLookup} disabled={loading || !url.trim()}>
              {loading ? "Looking up..." : "Lookup"}
            </Button>
          </div>
        </div>

        {preview && (
          <div className="space-y-4 p-4 bg-accent/30 rounded-md">
            <div>
              <p className="font-medium">{preview.title}</p>
              <p className="text-sm text-muted-foreground">
                {preview.views.toLocaleString()} views &middot; {preview.likes.toLocaleString()} likes
                &middot; Published {new Date(preview.publishedAt).toLocaleDateString()}
              </p>
            </div>

            <div>
              <Label>Event</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event..." />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Speaker(s)</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {speakers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSpeaker(s.id.toString())}
                    className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                      selectedSpeakers.includes(s.id.toString())
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent border-border"
                    }`}
                  >
                    {s.firstName} {s.lastName}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Video"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPreview(null);
                  setUrl("");
                  setEventId("");
                  setSelectedSpeakers([]);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
