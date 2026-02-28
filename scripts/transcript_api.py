"""
YouTube transcript fetching.
Adapted from d:\\coding\\openbox\\tools\\skills\\youtube_transcript\\main.py
"""

import re
import logging
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

logger = logging.getLogger(__name__)


def extract_video_id(url: str) -> str | None:
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/v/)([a-zA-Z0-9_-]{11})',
        r'^([a-zA-Z0-9_-]{11})$',
    ]
    for pattern in patterns:
        match = re.search(pattern, url.strip())
        if match:
            return match.group(1)
    return None


def get_transcript(video_id: str, languages: list[str] | None = None) -> dict:
    """
    Fetch transcript for a YouTube video.

    Returns dict with keys: text, language, is_generated, entries
    entries is a list of {text, start, duration} dicts.
    """
    if languages is None:
        languages = ['en']

    api = YouTubeTranscriptApi()
    try:
        transcript = api.fetch(video_id, languages=languages)
    except (TranscriptsDisabled, NoTranscriptFound):
        # Fall back to any available language
        transcript = api.fetch(video_id)

    entries = [
        {'text': s.text, 'start': s.start, 'duration': s.duration}
        for s in transcript.snippets
    ]
    full_text = " ".join(s.text for s in transcript.snippets)

    return {
        'text': full_text,
        'language': transcript.language_code,
        'is_generated': transcript.is_generated,
        'entries': entries,
    }


def format_timestamp(seconds: float) -> str:
    """Convert seconds to HH:MM:SS or MM:SS format."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"
