"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatSpeakerName } from "@/lib/speaker-name";

interface CollectionListItem {
  id: number;
  slug: string;
  title: string;
  intro: string | null;
  excludeEntertainment: number;
  published: number;
  videoCount: number;
  updatedAt: string;
}

interface PoolVideo {
  id: number;
  youtubeId: string;
  title: string | null;
  eventName: string | null;
  format: string;
  views: number | null;
  speakers: { id: number; firstName: string; lastName: string }[];
  categories: string[];
  themes: string[];
}

const FORMAT_LABELS: Record<string, string> = {
  talk: "Talk",
  interview: "Interview",
  entertainment: "Entertainment",
};

function speakerLabel(v: PoolVideo): string {
  return v.speakers.map((s) => formatSpeakerName(s)).filter(Boolean).join(" & ");
}

export function CollectionsManager() {
  const [collections, setCollections] = useState<CollectionListItem[]>([]);
  const [pool, setPool] = useState<PoolVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // null = list view; otherwise we're editing (slug) or creating ("__new__")
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [intro, setIntro] = useState("");
  const [published, setPublished] = useState(false);
  const [excludeEntertainment, setExcludeEntertainment] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // picker filters
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<Set<string>>(new Set());
  const [fmtFilter, setFmtFilter] = useState<Set<string>>(new Set());
  const [eventFilter, setEventFilter] = useState("");

  // generate-HTML dialog
  const [genOpen, setGenOpen] = useState(false);
  const [genHtml, setGenHtml] = useState<string | null>(null);
  const [genMeta, setGenMeta] = useState<{ count: number; bytes: number; title: string } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [genCopied, setGenCopied] = useState(false);

  const fetchCollections = async () => {
    try {
      const r = await fetch("/api/collections");
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      setCollections(await r.json());
    } catch (e) {
      setError(String(e));
    }
  };

  const fetchPool = async () => {
    try {
      const r = await fetch("/api/videos?facets=1");
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      setPool(await r.json());
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchCollections(), fetchPool()]);
      setLoading(false);
    })();
  }, []);

  // ── facet option lists derived from the pool ──────────────────────────────
  const allCategories = useMemo(() => {
    const s = new Set<string>();
    for (const v of pool) for (const c of v.categories) s.add(c);
    return Array.from(s).sort();
  }, [pool]);

  const allEvents = useMemo(() => {
    const s = new Set<string>();
    for (const v of pool) if (v.eventName) s.add(v.eventName);
    return Array.from(s).sort();
  }, [pool]);

  const poolById = useMemo(() => {
    const m = new Map<number, PoolVideo>();
    for (const v of pool) m.set(v.id, v);
    return m;
  }, [pool]);

  // ── filtered candidates (exclude already-selected) ────────────────────────
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sel = new Set(selectedIds);
    return pool.filter((v) => {
      if (sel.has(v.id)) return false;
      if (catFilter.size && !v.categories.some((c) => catFilter.has(c))) return false;
      if (fmtFilter.size && !fmtFilter.has(v.format)) return false;
      if (eventFilter && v.eventName !== eventFilter) return false;
      if (q) {
        const hay = (
          (v.title || "") +
          " " +
          speakerLabel(v) +
          " " +
          (v.eventName || "") +
          " " +
          v.categories.join(" ") +
          " " +
          v.themes.join(" ")
        ).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [pool, selectedIds, search, catFilter, fmtFilter, eventFilter]);

  // ── editor open/close ─────────────────────────────────────────────────────
  const resetFilters = () => {
    setSearch("");
    setCatFilter(new Set());
    setFmtFilter(new Set());
    setEventFilter("");
  };

  const openNew = () => {
    setEditingSlug("__new__");
    setTitle("");
    setIntro("");
    setPublished(false);
    setExcludeEntertainment(true);
    setSelectedIds([]);
    resetFilters();
  };

  const openEdit = async (slug: string) => {
    try {
      const r = await fetch(`/api/collections/${slug}`);
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      const data = await r.json();
      setEditingSlug(slug);
      setTitle(data.title);
      setIntro(data.intro || "");
      setPublished(!!data.published);
      setExcludeEntertainment(!!data.excludeEntertainment);
      setSelectedIds(data.videos.map((v: { videoId: number }) => v.videoId));
      resetFilters();
    } catch (e) {
      setError(String(e));
    }
  };

  const closeEditor = () => setEditingSlug(null);

  // ── selection mutations ───────────────────────────────────────────────────
  const addVideo = (id: number) => setSelectedIds((p) => (p.includes(id) ? p : [...p, id]));
  const removeVideo = (id: number) => setSelectedIds((p) => p.filter((x) => x !== id));
  const move = (idx: number, dir: -1 | 1) =>
    setSelectedIds((p) => {
      const next = [...p];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return p;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const toggleSetItem = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, val: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });

  // ── save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        intro: intro.trim(),
        published,
        excludeEntertainment,
        videoIds: selectedIds,
      };
      let res: Response;
      if (editingSlug === "__new__") {
        res = await fetch("/api/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/collections/${editingSlug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `Server returned ${res.status}`);
      }
      await fetchCollections();
      closeEditor();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (slug: string, name: string) => {
    if (!confirm(`Delete collection "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/collections/${slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      await fetchCollections();
    } catch (e) {
      setError(String(e));
    }
  };

  // ── generate HTML ───────────────────────────────────────────────────────
  const generate = async (slug: string) => {
    setGenOpen(true);
    setGenError(null);
    setGenHtml(null);
    setGenMeta(null);
    setGenCopied(false);
    try {
      const res = await fetch(`/api/export/squarespace?collection=${encodeURIComponent(slug)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setGenHtml(data.html);
      setGenMeta({ count: data.videoCount, bytes: data.byteSize, title: data.collection?.title || slug });
    } catch (e) {
      setGenError(String(e));
    }
  };

  const copyGen = async () => {
    if (!genHtml) return;
    try {
      await navigator.clipboard.writeText(genHtml);
      setGenCopied(true);
      setTimeout(() => setGenCopied(false), 2500);
    } catch {
      const ta = document.getElementById("gen-html-textarea") as HTMLTextAreaElement | null;
      if (ta) {
        ta.select();
        document.execCommand("copy");
        setGenCopied(true);
        setTimeout(() => setGenCopied(false), 2500);
      }
    }
  };

  const downloadGen = (slug: string) => {
    if (!genHtml) return;
    const blob = new Blob([genHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tedxstl-collection-${slug}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading collections…</p>;

  // ─────────────────────────────────────────────────────────────────────────
  // EDITOR VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (editingSlug) {
    const selectedVideos = selectedIds.map((id) => poolById.get(id)).filter(Boolean) as PoolVideo[];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">
            {editingSlug === "__new__" ? "New Collection" : "Edit Collection"}
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={closeEditor} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Collection"}
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Metadata */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="col-title">Title</Label>
                <Input
                  id="col-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Health & Wellness"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="col-intro">Intro line (optional)</Label>
                <Input
                  id="col-intro"
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  placeholder="e.g. A TEDxStLouis × St. Louis Magazine series"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={excludeEntertainment}
                  onChange={(e) => setExcludeEntertainment(e.target.checked)}
                />
                Exclude entertainment videos
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                />
                Published
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Two-column picker */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Candidates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Add videos{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({candidates.length} match)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Search title, speaker, theme, category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {/* Format toggles */}
              <div className="flex flex-wrap gap-1.5">
                {["talk", "interview", "entertainment"].map((f) => (
                  <button
                    key={f}
                    onClick={() => toggleSetItem(setFmtFilter, f)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                      fmtFilter.has(f)
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-input hover:bg-accent"
                    }`}
                  >
                    {FORMAT_LABELS[f]}
                  </button>
                ))}
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  className="ml-auto rounded-md border border-input bg-background px-2 py-0.5 text-xs"
                >
                  <option value="">All events</option>
                  {allEvents.map((ev) => (
                    <option key={ev} value={ev}>
                      {ev}
                    </option>
                  ))}
                </select>
              </div>
              {/* Category chips */}
              <div className="flex flex-wrap gap-1.5">
                {allCategories.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleSetItem(setCatFilter, c)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                      catFilter.has(c)
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-input hover:bg-accent"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {(catFilter.size > 0 || fmtFilter.size > 0 || eventFilter || search) && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Clear filters
                </button>
              )}

              <div className="max-h-[480px] space-y-1.5 overflow-y-auto pr-1">
                {candidates.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No videos match these filters.
                  </p>
                ) : (
                  candidates.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-start gap-2 rounded-md border p-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{v.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {speakerLabel(v) || "—"} · {v.eventName || "—"}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {v.format !== "talk" && (
                            <Badge variant="secondary" className="text-[10px]">
                              {FORMAT_LABELS[v.format]}
                            </Badge>
                          )}
                          {v.categories[0] && (
                            <Badge variant="outline" className="text-[10px]">
                              {v.categories[0]}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => addVideo(v.id)}>
                        Add
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                In this collection{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({selectedVideos.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedVideos.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No videos yet. Add some from the left — order here is the order on the page.
                </p>
              ) : (
                <ol className="space-y-1.5">
                  {selectedVideos.map((v, idx) => (
                    <li
                      key={v.id}
                      className="flex items-start gap-2 rounded-md border p-2 text-sm"
                    >
                      <span className="mt-0.5 w-5 text-right text-xs text-muted-foreground">
                        {idx + 1}.
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{v.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {speakerLabel(v) || "—"} · {v.eventName || "—"}
                        </p>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => move(idx, -1)}
                          disabled={idx === 0}
                          className="px-1 text-xs disabled:opacity-30"
                          aria-label="Move up"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => move(idx, 1)}
                          disabled={idx === selectedVideos.length - 1}
                          className="px-1 text-xs disabled:opacity-30"
                          aria-label="Move down"
                        >
                          ▼
                        </button>
                      </div>
                      <button
                        onClick={() => removeVideo(v.id)}
                        className="px-1 text-xs text-destructive"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIST VIEW
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Collections</h2>
          <p className="text-sm text-muted-foreground">
            Curated, branded video pages for partners &amp; marketing. Each exports to its own
            Squarespace page.
          </p>
        </div>
        <Button onClick={openNew}>New Collection</Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {collections.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No collections yet. Click <span className="font-medium">New Collection</span> to build
            your first themed page.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {collections.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.title}</span>
                    {c.published ? (
                      <Badge className="bg-green-600 text-[10px] hover:bg-green-600">Published</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Draft
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.videoCount} video{c.videoCount === 1 ? "" : "s"} · /{c.slug}
                    {c.intro ? ` · ${c.intro}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => generate(c.slug)}>
                    Generate HTML
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(c.slug)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => remove(c.slug, c.title)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generate HTML dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="sm:!max-w-3xl">
          <DialogHeader>
            <DialogTitle>Collection HTML{genMeta ? ` — ${genMeta.title}` : ""}</DialogTitle>
            <DialogDescription>
              {genError
                ? "Something went wrong generating the HTML."
                : genMeta
                  ? `${genMeta.count} videos · ${(genMeta.bytes / 1024).toFixed(1)} KB. Paste into a Squarespace Code Block on a full-width section.`
                  : "Generating…"}
            </DialogDescription>
          </DialogHeader>
          {genError ? (
            <p className="text-sm text-destructive">{genError}</p>
          ) : genHtml ? (
            <div className="space-y-3">
              <textarea
                id="gen-html-textarea"
                readOnly
                value={genHtml}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="h-64 w-full rounded-md border bg-muted/30 p-2 font-mono text-xs"
                spellCheck={false}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={copyGen}>
                  {genCopied ? "Copied!" : "Copy to Clipboard"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const slug = collections.find((c) => c.title === genMeta?.title)?.slug || "collection";
                    downloadGen(slug);
                  }}
                >
                  Download as .html
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
