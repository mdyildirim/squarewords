#!/usr/bin/env python3
"""
Simple HTTP server for SquareWords IQ static files.
Serves on 0.0.0.0:5000 with cache disabled for development.
"""
import http.server
import socketserver
from pathlib import Path

PORT = 5000
HOST = "0.0.0.0"

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with cache disabled."""
    
    def end_headers(self):
        """Add cache control headers before ending headers."""
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

if __name__ == "__main__":
    handler = NoCacheHTTPRequestHandler
    
    with socketserver.TCPServer((HOST, PORT), handler) as httpd:
        print(f"SquareWords IQ server running at http://{HOST}:{PORT}/")
        print("Press Ctrl+C to stop")
        httpd.serve_forever()
