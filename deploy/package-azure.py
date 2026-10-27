"""Package unchanged application files and a checksum-verified Linux Node binary.

Usage: python3 deploy/package-azure.py /path/to/node-v22.23.4-linux-x64.tar.xz
Outputs stay in the ignored artifacts/private directory. No credentials are read.
"""

from pathlib import Path
import hashlib
import json
import sys
import tarfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / "artifacts/private"
NODE_VERSION = "22.23.4"
NODE_ARCHIVE_SHA256 = "1805bcd35e6815559bd2eb97db438d3fdb0eb3a5e6a977b7c1badca76337e9ce"
archive = Path(sys.argv[1])
assert hashlib.sha256(archive.read_bytes()).hexdigest() == NODE_ARCHIVE_SHA256
top_files = ["index.html", "app.mjs", "style.css", "favicon.svg", "server.mjs",
             "package.json", "README.md", "LICENSE", ".env.example", ".nojekyll",
             "requirements-agent.txt", "requirements-agent.lock", "requirements-das.txt",
             "requirements-das.lock", "deploy/azure-startup.sh"]
directories = ["src", "data", "docs", "assets", "agent_runtime", "analytics", "tests", "scripts"]
paths = {ROOT / name for name in top_files}
for name in directories:
    for path in (ROOT / name).rglob("*"):
        if path.is_file() and not any(part.startswith(".") or part == "__pycache__" for part in path.relative_to(ROOT).parts):
            if path.suffix != ".pyc":
                paths.add(path)

PRIVATE.mkdir(parents=True, exist_ok=True)
output = PRIVATE / "offball-azure-app.zip"
manifest = {"nodeVersion": NODE_VERSION, "nodeArchiveSha256": NODE_ARCHIVE_SHA256,
            "nodeSource": f"https://nodejs.org/dist/v{NODE_VERSION}/node-v{NODE_VERSION}-linux-x64.tar.xz",
            "applicationFiles": {}}
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
    for path in sorted(paths):
        relative = path.relative_to(ROOT).as_posix()
        data = path.read_bytes()
        bundle.writestr(relative, data)
        manifest["applicationFiles"][relative] = hashlib.sha256(data).hexdigest()
    with tarfile.open(archive, "r:xz") as node_archive:
        prefix = f"node-v{NODE_VERSION}-linux-x64"
        for member, destination in [(f"{prefix}/bin/node", "deploy/runtime/node"),
                                    (f"{prefix}/LICENSE", "deploy/runtime/NODE-LICENSE")]:
            data = node_archive.extractfile(member).read()
            bundle.writestr(destination, data)
            manifest.setdefault("runtimeFiles", {})[destination] = hashlib.sha256(data).hexdigest()
manifest["archiveSha256"] = hashlib.sha256(output.read_bytes()).hexdigest()
manifest["archiveBytes"] = output.stat().st_size
(PRIVATE / "offball-azure-package-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps({"archive": str(output), "applicationFiles": len(paths),
                  "bytes": manifest["archiveBytes"], "sha256": manifest["archiveSha256"]}))
