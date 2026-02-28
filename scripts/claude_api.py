"""
Claude CLI wrapper with rate limiting, retry, and JSON response parsing.

Calls Claude via subprocess:
    subprocess.run(['claude', '--print', '--output-format', 'json'], ...)
"""

import subprocess
import json
import time
import logging

logger = logging.getLogger(__name__)

# Configuration
CALL_DELAY_SECONDS = 3.0
CALL_TIMEOUT_SECONDS = 120
MAX_RETRIES = 3

_last_call_time = 0.0


def call_claude(prompt: str, timeout: int | None = None) -> str:
    """
    Call Claude CLI and return the text response.
    Applies rate limiting and retries with exponential backoff.
    """
    global _last_call_time
    timeout = timeout or CALL_TIMEOUT_SECONDS

    for attempt in range(1, MAX_RETRIES + 1):
        # Rate limiting
        elapsed = time.time() - _last_call_time
        if elapsed < CALL_DELAY_SECONDS:
            time.sleep(CALL_DELAY_SECONDS - elapsed)

        cmd = ['claude', '--print', '--output-format', 'json']
        logger.debug(f"Claude CLI call attempt {attempt}/{MAX_RETRIES} "
                     f"(prompt: {len(prompt)} chars)")

        try:
            _last_call_time = time.time()
            result = subprocess.run(
                cmd,
                input=prompt,
                capture_output=True,
                text=True,
                timeout=timeout,
                encoding="utf-8",
            )

            if result.returncode != 0:
                logger.warning(f"Claude CLI returned code {result.returncode}: "
                               f"{result.stderr[:200]}")
                if attempt < MAX_RETRIES:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(
                    f"Claude CLI failed after {MAX_RETRIES} attempts: "
                    f"{result.stderr[:500]}"
                )

            stdout = result.stdout.strip()

            # Try parsing as JSON first (--output-format json)
            try:
                response = json.loads(stdout)
            except json.JSONDecodeError:
                # Not JSON — CLI returned plain text (newer versions with --print)
                if stdout:
                    return stdout
                raise RuntimeError("Claude returned empty output")

            # Handle structured JSON response formats
            # Format 1: {"content": [{"type": "text", "text": "..."}]}
            if isinstance(response, dict) and 'content' in response:
                content_blocks = response.get('content', [])
                for block in content_blocks:
                    if isinstance(block, dict) and block.get('type') == 'text':
                        text = block.get('text', '').strip()
                        if text:
                            return text

            # Format 2: {"result": "..."} or {"text": "..."} or {"response": "..."}
            if isinstance(response, dict):
                for key in ('result', 'text', 'response', 'output', 'message'):
                    val = response.get(key)
                    if isinstance(val, str) and val.strip():
                        return val.strip()

            # Format 3: response is just a string
            if isinstance(response, str) and response.strip():
                return response.strip()

            # Log the actual structure for debugging
            logger.error(f"Unexpected Claude CLI response structure: "
                         f"{json.dumps(response, indent=2)[:500]}")
            raise RuntimeError("Claude returned empty text content")

        except subprocess.TimeoutExpired:
            logger.warning(f"Claude CLI timed out after {timeout}s "
                           f"(attempt {attempt})")
            if attempt < MAX_RETRIES:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(
                f"Claude CLI timed out after {MAX_RETRIES} attempts"
            )

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse Claude CLI JSON: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(
                f"Claude CLI returned invalid JSON after {MAX_RETRIES} attempts"
            )

    raise RuntimeError("All retries exhausted")


def call_claude_json(prompt: str, timeout: int | None = None) -> dict | list:
    """
    Call Claude CLI and parse the response as JSON.
    Handles markdown code fence wrapping.
    """
    text = call_claude(prompt, timeout)

    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"Claude did not return valid JSON: {e}\nResponse: {text[:500]}"
        )
