# Copyright (c) Microsoft Corporation. Licensed under the MIT License.
"""Development-only static server; never included in the Pages artifact."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class StaticHandler(SimpleHTTPRequestHandler):
    # Windows registry MIME mappings can otherwise classify .mjs as text/plain.
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript"}

    def translate_path(self, path):
        prefix = "/webmcp-test-harness/"
        if path.startswith(prefix):
            path = "/" + path[len(prefix):]
        return super().translate_path(path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    arguments = parser.parse_args()
    repository = Path(__file__).resolve().parents[3]
    handler = partial(StaticHandler, directory=str(repository))
    with ThreadingHTTPServer(("127.0.0.1", arguments.port), handler) as server:
        print(f"Static harness: http://127.0.0.1:{arguments.port}/webmcp-test-harness/", flush=True)
        server.serve_forever()
