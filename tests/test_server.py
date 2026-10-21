import sys
from pathlib import Path
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from serve import CantieriHandler, url_bdtre

class QuietHandler(CantieriHandler):
    def log_message(self, *args):
        pass

class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def status(self, path, code, **kwargs):
        with self.assertRaises(HTTPError) as caught:
            urlopen(Request(self.base + path, **kwargs), timeout=2)
        self.assertEqual(caught.exception.code, code)

    def test_index_reale(self):
        with urlopen(self.base, timeout=2) as r:
            self.assertIn(b"Cantieri", r.read())

    def test_host_origin_e_file_privati(self):
        self.status("/", 403, headers={"Host":"example.invalid"})
        self.status("/api/bdtre?lat=45&lon=7&r=0.001", 403, headers={"Origin":"https://example.invalid"})
        for path in ["/.git/config", "/src/../.git/config", "/src/%2e%2e/.git/config", "/tools/serve.py", "/src/"]:
            self.status(path, 404)
        self.status("/", 405, method="HEAD")

    def test_proxy_rifiuta_input_esterni_al_contratto(self):
        for query in ["url=http://127.0.0.1", "lat=45&lon=7&r=2", "lat=nan&lon=7&r=0.001", "lat=45&lat=46&lon=7&r=0.001", "lat=90&lon=7&r=0.001"]:
            self.status("/api/bdtre?"+query, 400)

    def test_url_provenienza_fissa(self):
        url = url_bdtre({"lat":["45"],"lon":["7"],"r":["0.001"]})
        self.assertTrue(url.startswith("https://geoservices.csi.it/ms/wfs/taims/rp-01/taimswfs/bdtre_imm?"))
        self.assertIn("maxfeatures=40", url)

if __name__ == "__main__":
    unittest.main()
