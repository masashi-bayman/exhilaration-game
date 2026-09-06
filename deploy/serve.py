#!/usr/bin/env python3
"""
EXHILARATION を配信する小さな静的サーバ（ラズパイ用）。

  python3 deploy/serve.py            # 0.0.0.0:8080 で配信
  python3 deploy/serve.py 8000       # ポート指定

.webmanifest を正しい MIME で返す点だけが http.server と違います
（Chrome がマニフェストを読めないと PWA としてインストールできないため）。
"""
import http.server
import os
import socket
import socketserver
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.webmanifest': 'application/manifest+json',
        '.json': 'application/json',
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.wasm': 'application/wasm',
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Service Worker は毎回取り直させる（更新が反映されないのを防ぐ）
        if self.path.endswith('/sw.js') or self.path.endswith('/sw.js?'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Service-Worker-Allowed', '/')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    with Server(('0.0.0.0', port), Handler) as httpd:
        print('EXHILARATION serving %s' % ROOT)
        print('  ローカル : http://localhost:%d/' % port)
        print('  LAN     : http://%s:%d/' % (lan_ip(), port))
        print('Ctrl+C で停止')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nbye')
