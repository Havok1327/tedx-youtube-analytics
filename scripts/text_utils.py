"""
text_utils.py — Utilities for matching quote text to transcript entries.

Used to correct Claude-estimated clip timestamps by aligning quote text
against the precise start/duration values from YouTube transcript entries.
"""

import re
import unicodedata


def normalize_text(text: str) -> str:
    """Lowercase, strip punctuation/accents, collapse whitespace."""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def correct_timestamps(quote_text: str, entries: list[dict]) -> tuple[float, float] | None:
    """
    Find the best matching span in transcript entries for the given quote text.

    Returns (start_time, end_time) in seconds, or None if no match found.

    Strategy 1: exact normalized substring match against concatenated transcript.
    Strategy 2 fallback: sliding window word overlap (>=60% threshold).

    Each entry is expected to have keys: 'start', 'duration', 'text'.
    """
    if not quote_text or not entries:
        return None

    norm_quote = normalize_text(quote_text)
    if not norm_quote:
        return None

    # ── Strategy 1: substring match on concatenated normalized text ──────────
    # Build a list of (char_start, char_end, entry_index) to map positions back
    segments = []  # (char_start, char_end, entry_index)
    concat = ""
    for i, entry in enumerate(entries):
        norm = normalize_text(entry.get("text", ""))
        if not norm:
            continue
        char_start = len(concat)
        if concat:
            concat += " "
            char_start += 1
        concat += norm
        segments.append((char_start, len(concat), i))

    pos = concat.find(norm_quote)
    if pos != -1:
        match_end = pos + len(norm_quote)
        first_entry = None
        last_entry = None
        for char_start, char_end, idx in segments:
            # Entry overlaps with match span
            if char_end > pos and char_start < match_end:
                if first_entry is None:
                    first_entry = idx
                last_entry = idx
        if first_entry is not None and last_entry is not None:
            start_entry = entries[first_entry]
            end_entry = entries[last_entry]
            start = start_entry["start"]
            end = end_entry["start"] + end_entry.get("duration", 2.0)
            return (start, end)

    # ── Strategy 2: sliding window word overlap ──────────────────────────────
    quote_words = norm_quote.split()
    if not quote_words:
        return None

    window = len(quote_words)
    best_score = 0.0
    best_span = None

    # Build word list with entry indices
    all_words = []  # (word, entry_index)
    for i, entry in enumerate(entries):
        for w in normalize_text(entry.get("text", "")).split():
            all_words.append((w, i))

    if len(all_words) < window:
        window = len(all_words)

    quote_set = set(quote_words)

    for start_pos in range(len(all_words) - window + 1):
        window_words = [w for w, _ in all_words[start_pos:start_pos + window]]
        overlap = sum(1 for w in window_words if w in quote_set)
        score = overlap / len(quote_words)
        if score > best_score:
            best_score = score
            best_span = (all_words[start_pos][1], all_words[start_pos + window - 1][1])

    if best_score >= 0.6 and best_span is not None:
        first_idx, last_idx = best_span
        start_entry = entries[first_idx]
        end_entry = entries[last_idx]
        start = start_entry["start"]
        end = end_entry["start"] + end_entry.get("duration", 2.0)
        return (start, end)

    return None
