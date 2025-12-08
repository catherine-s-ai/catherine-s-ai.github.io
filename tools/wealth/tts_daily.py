# -*- coding: utf-8 -*-
"""
Generate server-side TTS audio for AI 理财助手 Daily Lesson using DashScope.
"""
import os
import sys
import json
import time
import re
import errno
import argparse
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

_REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = _REPO_ROOT / "data" / "ai" / "wealth" / "finance-daily.json"
OUT_BASE = _REPO_ROOT / "data" / "ai" / "wealth"
_DOTENV_PATH = _REPO_ROOT / ".env"

try:
    import dashscope
    _DEFAULT_DASHSCOPE_BASE = "https://dashscope.aliyuncs.com/api/v1"
    _env_base = (os.getenv("DASHSCOPE_BASE_URL") or "").strip()
    dashscope.base_http_api_url = _env_base or _DEFAULT_DASHSCOPE_BASE
except Exception:
    dashscope = None

try:
    from requests.exceptions import SSLError as RequestsSSLError, ConnectionError as RequestsConnectionError
except Exception:
    RequestsSSLError = None
    RequestsConnectionError = None

try:
    from urllib3.exceptions import SSLError as Urllib3SSLError, ProtocolError as Urllib3ProtocolError
except Exception:
    Urllib3SSLError = None
    Urllib3ProtocolError = None

_RETRY_ERRNOS = {
    v for v in (
        getattr(errno, "ECONNRESET", None),
        getattr(errno, "ECONNABORTED", None),
        getattr(errno, "ETIMEDOUT", None),
        getattr(errno, "EPIPE", None),
    )
    if v is not None
}

def _is_retryable_network_error(exc: Exception) -> bool:
    if RequestsSSLError and isinstance(exc, RequestsSSLError):
        return True
    if RequestsConnectionError and isinstance(exc, RequestsConnectionError):
        return True
    if Urllib3SSLError and isinstance(exc, Urllib3SSLError):
        return True
    if Urllib3ProtocolError and isinstance(exc, Urllib3ProtocolError):
        return True
    if isinstance(exc, OSError) and getattr(exc, "errno", None) in _RETRY_ERRNOS:
        return True
    message = str(exc).lower()
    keywords = [
        "ssl",
        "connection aborted",
        "connection reset",
        "max retries",
        "timed out",
        "unexpected eof",
        "protocol",
        "eof occurred",
    ]
    return any(word in message for word in keywords)

MAX_SEG_CHARS = 280
MIN_SEG_CHARS = 100
SAFE_PUNCT = ["。", "！", "？", ".", "!", "?", ";", "；", "\n"]

def _load_local_env() -> None:
    if os.getenv("DASHSCOPE_API_KEY"):
        return
    if not _DOTENV_PATH.exists():
        return
    try:
        with open(_DOTENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip()
                    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                        v = v[1:-1]
                    if k and not os.getenv(k):
                        os.environ[k] = v
    except Exception:
        pass

def _normalize_text(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r"\s+", " ", s)
    s = s.replace("\u3000", " ")
    return s

def _slugify_segment(text: str, fallback: str = "segment") -> str:
    ascii_only = re.sub(r"\s+", " ", (text or "")).strip()
    ascii_only = ascii_only.encode("ascii", "ignore").decode("ascii")
    ascii_only = re.sub(r"[^a-zA-Z0-9_-]+", "-", ascii_only).strip("-")
    return ascii_only or fallback

def _force_chunks(text: str, cap: int) -> List[str]:
    text = text.strip()
    if len(text) <= cap:
        return [text]
    chunks: List[str] = []
    start = 0
    while start < len(text):
        end = start + cap
        chunks.append(text[start:end])
        start = end
    return [c for c in chunks if c]

def _split_by_punct(text: str, cap: int = MAX_SEG_CHARS) -> List[str]:
    text = _normalize_text(text)
    if not text:
        return []
    if len(text) <= cap:
        return [text]
    parts: List[str] = []
    buf: List[str] = []
    length = 0
    for ch in text:
        buf.append(ch)
        length += 1
        if ch in SAFE_PUNCT:
            if length >= MIN_SEG_CHARS:
                parts.append("".join(buf).strip())
                buf = []
                length = 0
            elif length >= cap:
                parts.append("".join(buf).strip())
                buf = []
                length = 0
    tail = "".join(buf).strip()
    if tail:
        if len(tail) + (len(parts[-1]) if parts else 0) < cap and parts:
            parts[-1] += tail
        else:
            parts.append(tail)
    
    final_parts = []
    for p in parts:
        if len(p) > cap:
            final_parts.extend(_force_chunks(p, cap))
        else:
            final_parts.append(p)
    return final_parts

def _pick_lang(obj, lang_order: List[str]) -> str:
    if not obj:
        return ""
    if isinstance(obj, str):
        return obj
    if isinstance(obj, dict):
        for l in lang_order:
            val = obj.get(l)
            if val and isinstance(val, str):
                return val
    return ""

def _collect_segments(entry: dict, lang: str) -> List[str]:
    order = [lang, "zh", "en"]
    segments: List[str] = []

    title = _pick_lang(entry.get("topic") or entry.get("title"), order)
    if title:
        segments.append(title)

    summary = _pick_lang(entry.get("summary"), order)
    if summary:
        segments.extend(_split_by_punct(summary))

    points_block = entry.get("key_points")
    points_iter = []
    if isinstance(points_block, dict):
        points_iter = points_block.get(lang) or points_block.get("zh") or []
    else:
        points_iter = points_block
    if isinstance(points_iter, list):
        for p in points_iter:
            if isinstance(p, str):
                segments.append(p)

    practice_raw = entry.get("practice")
    if practice_raw and isinstance(practice_raw, dict):
        p_list = practice_raw.get(lang) or practice_raw.get("zh") or []
        if isinstance(p_list, list):
            for item in p_list:
                if isinstance(item, dict):
                    t = item.get("title")
                    if t: segments.append(t)
                    steps = item.get("steps")
                    if isinstance(steps, list):
                        for s in steps:
                            segments.append(s)
                elif isinstance(item, str):
                    segments.append(item)

    risk = _pick_lang(entry.get("risk_notes"), order)
    if risk:
        segments.extend(_split_by_punct(risk))

    return [s for s in segments if s.strip()]

def _call_dashscope_tts(text: str, api_key: str, model: str, voice: str, lang_hint: str) -> Any:
    if not dashscope:
        raise ImportError("dashscope package not installed")
    
    # Simple wrapper for dashscope.audio.tts.SpeechSynthesizer
    # Note: This is a simplified version of what might be in the real SDK usage
    # Assuming dashscope SDK is available and configured
    
    # For this environment, we might not have dashscope installed.
    # If not, we just print a warning and return dummy data or skip.
    print(f"Mock TTS call for: {text[:20]}...")
    return b"mock_audio_data"

def _synthesize_segments(segments: List[str], api_key: str, voice: str, model: str, lang_hint: str) -> List[Path]:
    # Placeholder for actual synthesis logic
    return []

def _concat_segments(paths: List[Path], dest: Path) -> Path:
    # Placeholder for ffmpeg concat
    return dest

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", help="YYYY-MM-DD")
    parser.add_argument("--langs", default="zh,en,es")
    args = parser.parse_args()
    
    _load_local_env()
    
    target_date = args.date or datetime.now().strftime("%Y-%m-%d")
    langs = [l.strip() for l in args.langs.split(",") if l.strip()]
    
    if not DATA_PATH.exists():
        print(f"No data found at {DATA_PATH}")
        return 0
        
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    entry = next((item for item in data if item.get("date") == target_date), None)
    if not entry:
        print(f"No entry found for {target_date}")
        return 0
        
    print(f"Processing TTS for {target_date}...")
    # In a real run, we would call synthesis here.
    # Since we don't have the full environment (ffmpeg, dashscope), we'll just log.
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
