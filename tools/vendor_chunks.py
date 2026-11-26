#!/usr/bin/env python3
"""Download every webapp chunk listed in the vendored runtime's chunk map."""
import concurrent.futures
import gzip
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
VENDOR = ROOT / "vendor"
BASE = "https://s.pinimg.com/webapp/"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0.0.0 Safari/537.36")


def all_chunk_names() -> set[str]:
    names = set()
    for runtime in VENDOR.glob("runtime-*.mjs"):
        text = runtime.read_text(encoding="utf-8", errors="replace")
        names |= set(re.findall(r'return"([A-Za-z0-9_./-]+\.(?:mjs|css))"', text))

    # Route chunks use dynamic segments like [id] and [username]; the runtime
    # chunk map doesn't include them, but __PWS_ROUTES__ lists every dependency.
    shell = (ROOT / "data" / "pinterest_home.html").read_text(encoding="utf-8")
    match = re.search(r'<script id="__PWS_ROUTES__" type="application/json">(.*?)</script>', shell, re.S)
    if match:
        routes = json.loads(match.group(1))

        def collect(value):
            if isinstance(value, dict):
                for key, item in value.items():
                    if key == "dependencies" and isinstance(item, list):
                        for dep in item:
                            if dep.startswith(BASE):
                                names.add(urllib.parse.unquote(dep[len(BASE):]))
                    else:
                        collect(item)
            elif isinstance(value, list):
                for item in value:
                    collect(item)

        collect(routes)
    return {name for name in names if name.endswith((".mjs", ".css"))}


def fetch(name: str) -> tuple[str, int]:
    dest = VENDOR / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size:
        return name, 0
    url = BASE + urllib.parse.quote(name, safe="/")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    err = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            if data[:2] == b"\x1f\x8b":
                data = gzip.decompress(data)
            dest.write_bytes(data)
            return name, len(data)
        except Exception as exc:
            err = exc
            time.sleep(0.3 * (attempt + 1))
    raise RuntimeError(f"{name}: {err}")


def localize_assets() -> int:
    """Rewrite absolute asset URLs in vendored chunks to local /webapp paths."""
    changed = 0
    for path in VENDOR.rglob("*"):
        if not path.is_file() or path.suffix not in {".mjs", ".js", ".css"}:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        localized = text.replace(BASE, "/webapp/")
        localized = localized.replace(
            '"https://ct.pinterest.com/ct.html"',
            'location.origin+"/assets/ct.html"',
        )
        if localized != text:
            path.write_text(localized, encoding="utf-8")
            changed += 1
    return changed


def main() -> None:
    names = all_chunk_names()
    print(f"Chunk map contains {len(names)} files")
    total = 0
    count = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(fetch, n) for n in sorted(names)]
        for future in concurrent.futures.as_completed(futures):
            try:
                name, size = future.result()
            except Exception as exc:
                print(f"  FAILED {exc}")
                continue
            if size:
                count += 1
                total += size
    print(f"Downloaded {count} new chunks ({total:,} bytes)")
    print(f"Localized {localize_assets()} vendored files")


if __name__ == "__main__":
    main()
