"use client";

import { useEffect, useState } from "react";
import { CsvImport } from "@/components/csv-import";
import { VideoForm } from "@/components/video-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface Event {
  id: number;
  name: string;
}

interface Speaker {
  id: number;
  firstName: string;
  lastName: string;
}

export default function ManagePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);

  // New event form
  const [newEventName, setNewEventName] = useState("");
  const [addingEvent, setAddingEvent] = useState(false);

  // New speaker form
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [addingSpeaker, setAddingSpeaker] = useState(false);

  // Refresh
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);

  const fetchData = async () => {
    const [evts, spks] = await Promise.all([
      fetch("/api/events").then((r) => r.json()),
      fetch("/api/speakers").then((r) => r.json()),
    ]);
    setEvents(evts);
    setSpeakers(spks);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
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

  const handleAddSpeaker = async () => {
    if (!newLastName.trim()) return;
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

      {/* Refresh Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Refresh YouTube Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Fetch latest view counts and likes from YouTube for all videos. This also creates a new history snapshot.
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
        </CardContent>
      </Card>

      <Separator />

      {/* CSV Import */}
      <CsvImport />

      <Separator />

      {/* Add Video */}
      <VideoForm events={events} speakers={speakers} onSuccess={fetchData} />

      <Separator />

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
              <span
                key={e.id}
                className="px-3 py-1 text-sm rounded-full bg-accent text-accent-foreground"
              >
                {e.name}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

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
            <Button onClick={handleAddSpeaker} disabled={addingSpeaker || !newLastName.trim()}>
              Add Speaker
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
            {speakers.map((s) => (
              <span key={s.id} className="text-sm px-2 py-1">
                {s.firstName} {s.lastName}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
