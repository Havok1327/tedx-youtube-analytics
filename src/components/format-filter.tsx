"use client";

import { useEffect, useState, useCallback } from "react";
import { ALL_FORMATS, type VideoFormat } from "@/lib/format-filter";

export type { VideoFormat } from "@/lib/format-filter";
export { ALL_FORMATS, buildFormatsParam, parseFormatsParam, isAllFormatsSelected } from "@/lib/format-filter";

const STORAGE_KEY = "tedx_format_filter";

/**
 * Shared format-filter state. Persists across navigation and reloads via
 * localStorage. Default is all three formats selected (preserves the
 * report semantics that existed before Deploy 2 — nothing accidentally
 * disappears for someone who never touches the picker).
 *
 * Empty-array fallback: if the user toggles all three off, the hook
 * treats it as "all on" so analytics queries never silently return zero.
 */
export function useFormatFilter() {
  const [formats, setFormatsState] = useState<VideoFormat[]>([...ALL_FORMATS]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (f): f is VideoFormat =>
              typeof f === "string" && (ALL_FORMATS as readonly string[]).includes(f)
          );
          if (valid.length > 0) setFormatsState(valid);
        }
      }
    } catch {
      /* localStorage unavailable or JSON malformed — ignore, keep defaults */
    }
    setHydrated(true);
  }, []);

  const setFormats = useCallback((next: VideoFormat[]) => {
    const valid = next.filter((f) => (ALL_FORMATS as readonly string[]).includes(f));
    const final: VideoFormat[] = valid.length > 0 ? valid : [...ALL_FORMATS];
    setFormatsState(final);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(final));
    } catch {
      /* localStorage write failed (e.g., private window full) — ignore */
    }
  }, []);

  return { formats, setFormats, hydrated };
}

interface FormatFilterProps {
  formats: VideoFormat[];
  onChange: (next: VideoFormat[]) => void;
  /** Hide the leading "Show:" label */
  compact?: boolean;
}

const LABELS: Record<VideoFormat, string> = {
  talk: "Talks",
  interview: "Interviews",
  entertainment: "Entertainment",
};

/** Three pill-style toggles. Click to add/remove a format from the active set. */
export function FormatFilter({ formats, onChange, compact = false }: FormatFilterProps) {
  const toggle = (f: VideoFormat) => {
    if (formats.includes(f)) {
      onChange(formats.filter((x) => x !== f));
    } else {
      onChange([...formats, f]);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!compact && <span className="text-xs text-muted-foreground">Show:</span>}
      <div className="flex gap-1 rounded-md border bg-background p-0.5">
        {ALL_FORMATS.map((f) => {
          const active = formats.includes(f);
          return (
            <button
              key={f}
              type="button"
              onClick={() => toggle(f)}
              aria-pressed={active}
              className={
                "px-3 py-1 text-xs rounded transition-colors " +
                (active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent")
              }
            >
              {LABELS[f]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
