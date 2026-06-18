import http.server
import json
import os

PORT = 8080
DATA_FILE = "restaurants.json"

class EatingPickerHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/restaurants":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    content = f.read()
                    self.wfile.write(content.encode("utf-8"))
            else:
                # If server JSON file doesn't exist, return empty array
                self.wfile.write(json.dumps([]).encode("utf-8"))
        else:
            # Serve static files normally
            super().do_GET()

    def do_POST(self):
        if self.path == "/api/restaurants":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                # Parse and validate JSON data
                data = json.loads(post_data.decode("utf-8"))
                
                # Write to local JSON file
                with open(DATA_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=4)
                
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "count": len(data)}).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == "__main__":
    import socketserver
    socketserver.TCPServer.allow_reuse_address = True
    print(f"Starting Eating Picker Server on http://localhost:{PORT}")
    try:
        with socketserver.TCPServer(("", PORT), EatingPickerHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
