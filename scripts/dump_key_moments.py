"""Dump video_key_moments from local.db to key_moments_dump.json for prod push."""
import json, sqlite3
from pathlib import Path

db_path = Path(__file__).parent.parent / "local.db"
conn = sqlite3.connect(str(db_path))
conn.row_factory = sqlite3.Row

rows = conn.execute("""
    SELECT video_id, quote_text, context, start_time, end_time, generated_at
    FROM video_key_moments ORDER BY video_id, start_time
""").fetchall()
conn.close()

data = [dict(r) for r in rows]
out = Path(__file__).parent / "key_moments_dump.json"
out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Dumped {len(data)} key moments to {out}")
