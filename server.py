#!/usr/bin/env python3
"""Development HTTP server for SquareWords IQ.

This server mirrors the behaviour of the Express server so the front-end can
fetch `/api/puzzle` while running locally without Node.  It also disables cache
headers to make iterating on the UI easier.
"""
from __future__ import annotations

import http.server
import json
import logging
import os
import socketserver
import time
import uuid
from typing import Any, Dict
from urllib import request

PORT = 5000
HOST = "0.0.0.0"
GEMINI_MODEL = "gemini-2.5-flash"
LOG = logging.getLogger("squarewords.server")


DEFAULT_PUZZLE = {
    "words": [
        "nebula",
        "orbit",
        "quartz",
        "mystic",
        "riddle",
        "pixel",
        "sonic",
        "lunar",
        "glyph",
        "vivid",
        "nova",
        "spark",
    ],
    "insight": (
        "Today's grid is tuned for dreamers. Chase luminous patterns, stack "
        "quick wins, and your NeuroSpark IQ will skyrocket."
    ),
    "theme": "Cosmic Curiosity",
}


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with cache disabled and JSON API support."""

    server_version = "SquareWordsHTTP/1.0"

    def end_headers(self) -> None:  # type: ignore[override]
        """Add cache control headers before ending headers."""
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self) -> None:  # type: ignore[override]
        if self.path.startswith("/api/puzzle"):
            self._handle_puzzle_request()
            return

        super().do_GET()

    # ------------------------------------------------------------------
    # Puzzle API handling
    # ------------------------------------------------------------------
    def _handle_puzzle_request(self) -> None:
        request_id = f"{int(time.time() * 1000):x}-{uuid.uuid4().hex[:8]}"
        start = time.time()
        LOG.info("Puzzle request received [id=%s]", request_id)

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            LOG.warning(
                "GEMINI_API_KEY missing, sending fallback puzzle [id=%s]",
                request_id,
            )
            self._send_json(DEFAULT_PUZZLE)
            LOG.info(
                "Puzzle request served with fallback data [id=%s, total_ms=%s]",
                request_id,
                _elapsed_ms(start),
            )
            return

        try:
            payload = self._request_gemini_puzzle(api_key, request_id)
        except Exception:  # pragma: no cover - diagnostic logging
            LOG.exception("Gemini fetch failed [id=%s]", request_id)
            payload = DEFAULT_PUZZLE
            LOG.warning(
                "Falling back to default puzzle after Gemini failure [id=%s]",
                request_id,
            )

        self._send_json(payload)
        LOG.info(
            "Puzzle request completed [id=%s, total_ms=%s, word_count=%s]",
            request_id,
            _elapsed_ms(start),
            len(payload.get("words", [])),
        )

    def _send_json(self, data: Dict[str, Any]) -> None:
        body = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _request_gemini_puzzle(self, api_key: str, request_id: str) -> Dict[str, Any]:
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{GEMINI_MODEL}:generateContent?key={api_key}"
        )
        prompt = (
            "You are creating the daily puzzle for a mobile word-grid game similar"
            " to Boggle.\n"
            'Return a strict JSON object with keys "words", "insight", and '
            '"theme".\n- "words" must be an array of 10 to 14 unique English '
            "nouns, verbs, or adjectives, each 4-7 letters long, lowercase.\n"
            '- "insight" must be a short (max 220 characters) hype message that '
            "references the theme and encourages the player.\n"
            '- "theme" must be 2-3 words describing the shared mood of the list.'
            "\nRespond with JSON only."
        )

        payload = json.dumps(
            {
                "contents": [
                    {
                        "parts": [
                            {
                                "text": prompt,
                            }
                        ]
                    }
                ]
            }
        ).encode("utf-8")

        LOG.info(
            "Requesting puzzle from Gemini [id=%s, model=%s]",
            request_id,
            GEMINI_MODEL,
        )
        req = request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        remote_start = time.time()
        with request.urlopen(req, timeout=15) as response:
            LOG.info(
                "Gemini response received [id=%s, status=%s, latency_ms=%s]",
                request_id,
                response.status,
                _elapsed_ms(remote_start),
            )

            if response.status != 200:
                raise RuntimeError(f"HTTP {response.status}")

            raw_body = response.read().decode("utf-8")
        payload = json.loads(raw_body)
        text = (
            payload.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
            .strip()
        )
        if not text:
            raise RuntimeError("No content returned")

        json_start = text.find("{")
        json_end = text.rfind("}")
        if json_start == -1 or json_end == -1:
            raise RuntimeError("Invalid JSON payload")

        parsed = json.loads(text[json_start : json_end + 1])
        words = [
            word.lower()
            for word in parsed.get("words", [])
            if isinstance(word, str) and word.isalpha()
        ]
        if not words:
            raise RuntimeError("Invalid words payload")

        unique_words = sorted(set(words))
        insight = parsed.get("insight") or "Lexicon locked and loaded—time to flex!"
        theme = parsed.get("theme") or "Freestyle Flow"
        LOG.info(
            "Gemini payload parsed successfully [id=%s, word_count=%s]",
            request_id,
            len(unique_words),
        )
        return {"words": unique_words, "insight": insight, "theme": theme}


def _elapsed_ms(start: float) -> int:
    return int((time.time() - start) * 1000)


def main() -> None:
    configure_logging()
    handler = NoCacheHTTPRequestHandler

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((HOST, PORT), handler) as httpd:
        LOG.info("SquareWords IQ server running at http://%s:%s/", HOST, PORT)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            LOG.info("Server shutdown requested by user")
        finally:
            httpd.server_close()


if __name__ == "__main__":
    main()
