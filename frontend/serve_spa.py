import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = int(os.environ.get("PORT", sys.argv[1] if len(sys.argv) > 1 else 3001))
BUILD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")

class SPAHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BUILD_DIR, **kwargs)

    def do_GET(self):
        # Remove query params for file lookup
        clean_path = self.path.split('?')[0].split('#')[0]
        full_path = os.path.normpath(os.path.join(BUILD_DIR, clean_path.lstrip('/')))
        
        # Se for um ficheiro existente (css, js, imagens, etc.), serve directamente
        if os.path.isfile(full_path):
            return super().do_GET()
        
        # Caso contrário (rotas SPA como /arquivo, /confronto, /login), serve o index.html
        self.path = '/index.html'
        return super().do_GET()

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), SPAHandler)
    print(f"Frontend SPA rodando em http://0.0.0.0:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
