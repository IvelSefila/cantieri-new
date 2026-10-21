"""Server locale Cantieri con solo proxy BDTRE Piemonte, senza dipendenze.
Avvio: python tools/serve.py --port 8765. Ascolta esclusivamente su loopback.
"""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import math
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit, unquote
from urllib.request import Request, HTTPRedirectHandler, build_opener

ROOT = Path(__file__).resolve().parents[1]
BDTRE = "https://geoservices.csi.it/ms/wfs/taims/rp-01/taimswfs/bdtre_imm"

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

OPENER = build_opener(NoRedirect())

def url_bdtre(query):
    if set(query) != {"lat", "lon", "r"} or any(len(x) != 1 for x in query.values()):
        raise ValueError("Parametri richiesti: lat, lon, r")
    lat, lon, radius = (float(query[k][0]) for k in ("lat", "lon", "r"))
    if not all(math.isfinite(x) for x in (lat, lon, radius)) or not (44 <= lat <= 47 and 6 <= lon <= 10 and 0 < radius <= 0.001):
        raise ValueError("Coordinate o raggio fuori ambito Piemonte")
    bbox = f"{lat-radius:.6f},{lon-radius:.6f},{lat+radius:.6f},{lon+radius:.6f},EPSG:4326"
    return BDTRE + "?" + urlencode({"service":"WFS","version":"1.1.0","request":"GetFeature","typename":"un_vol","maxfeatures":40,"srsname":"EPSG:4326","bbox":bbox})

class CantieriHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        hosts = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
        if self.headers.get("Host") not in hosts:
            self.send_error(403, "Host non ammesso")
            return
        target = urlsplit(self.path)
        if target.path == "/api/bdtre":
            origin = self.headers.get("Origin")
            if origin and urlsplit(origin).netloc not in hosts:
                self.send_error(403, "Origin non ammessa")
                return
            try:
                url = url_bdtre(parse_qs(target.query, max_num_fields=3))
            except (ValueError, OverflowError):
                self.send_error(400, "Coordinate o parametri non validi")
                return
            try:
                request = Request(url, headers={"User-Agent":"CantieriNew/0.1 (https://github.com/IvelSefila/cantieri-new)", "Accept":"application/xml"})
                with OPENER.open(request, timeout=6) as response:
                    data = response.read(2_000_001)
                if len(data) > 2_000_000 or b"FeatureCollection" not in data:
                    raise ValueError("Risposta BDTRE non valida")
                self.send_response(200)
                self.send_header("Content-Type", "application/xml; charset=utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "private, max-age=120")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                self.wfile.write(data)
            except Exception:
                self.send_error(502, "Servizio BDTRE non disponibile")
            return
        path = unquote(target.path)
        top = path.strip("/").split("/")[0]
        if ".." in path.split("/") or top not in {"", "index.html", "src", "vendor", "assets", "data"} or any(part.startswith(".") for part in path.split("/") if part):
            self.send_error(404)
            return
        super().do_GET()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def do_HEAD(self):
        self.send_error(405, "Solo GET consentito")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), CantieriHandler)
    print(f"Cantieri: http://127.0.0.1:{server.server_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
