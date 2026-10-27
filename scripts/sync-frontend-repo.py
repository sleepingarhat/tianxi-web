"""發布後將網站源碼同步入 GitHub tianxi-web（經 GitHub API，保留 legacy-site/；產品 README 同步）。"""
import base64, hashlib, os, subprocess, time, requests

REPO = "sleepingarhat/tianxi-web"
API = f"https://api.github.com/repos/{REPO}"
H = {"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}", "Accept": "application/vnd.github+json"}
KEEP = ("legacy-site/",)
SKIP_DIRS = {".git", "node_modules", "dist", ".output", ".wrangler", ".lovable", ".tanstack", "__pycache__"}

def req(m, url, **kw):
    for i in range(5):
        r = requests.request(m, url, headers=H, timeout=60, **kw)
        if r.status_code < 500 and r.status_code != 403:
            if r.status_code >= 400: print(r.text[:300])
            r.raise_for_status(); return r.json()
        time.sleep(3 * (i + 1))
    r.raise_for_status()

def local_files():
    out = {}
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            p = os.path.relpath(os.path.join(root, f), ".")
            # 建置自動產生檔（例如 tsconfig.tsbuildinfo）唔入鏡像
            if f.endswith(".tsbuildinfo"): continue
            if f in (".env", ".git") or f == ".env" or f.startswith(".env.") or p.startswith(KEEP): continue
            out[p] = open(p, "rb").read()
    return out

ref = req("GET", f"{API}/git/ref/heads/main")
head = ref["object"]["sha"]
base_tree = req("GET", f"{API}/git/commits/{head}")["tree"]["sha"]
remote = {e["path"]: e["sha"] for e in req("GET", f"{API}/git/trees/{base_tree}?recursive=1")["tree"] if e["type"] == "blob"}
local = local_files()
changes = []
for p, data in local.items():
    sha = hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()
    if remote.get(p) != sha:
        b = req("POST", f"{API}/git/blobs", json={"content": base64.b64encode(data).decode(), "encoding": "base64"})
        changes.append({"path": p, "mode": "100644", "type": "blob", "sha": b["sha"]})
for p in remote:
    if p not in local and not p.startswith(KEEP):
        changes.append({"path": p, "mode": "100644", "type": "blob", "sha": None})
if not changes: print("no changes"); raise SystemExit
tree = req("POST", f"{API}/git/trees", json={"base_tree": base_tree, "tree": changes})
msg = os.environ.get("SYNC_COMMIT_MESSAGE") or "sync: 正式站發布 " + time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime())
c = req("POST", f"{API}/git/commits", json={"message": msg, "tree": tree["sha"], "parents": [head]})
req("PATCH", f"{API}/git/refs/heads/main", json={"sha": c["sha"]})
print(f"pushed {c['sha'][:7]} ({len(changes)} files)")
