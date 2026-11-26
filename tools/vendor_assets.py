#!/usr/bin/env python3
"""Download the Pinterest PWS webapp assets referenced by a captured HTML page.

Usage: python3 tools/vendor_assets.py /path/to/pinterest_home.html
"""
import concurrent.futures
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
VENDOR = ROOT / "vendor"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0.0.0 Safari/537.36")


def collect(html: str) -> list[str]:
    urls = set(re.findall(r'https://s\.pinimg\.com/webapp/[A-Za-z0-9_./-]+\.(?:mjs|css|js|map|woff2?)', html))
    # The manifest embedded in inline scripts uses escaped slashes too.
    urls |= set(u.replace('\\/', '/') for u in re.findall(
        r'https:\\/\\/s\.pinimg\.com\\/webapp\\/[A-Za-z0-9_./-]+?\.(?:mjs|css|js|map|woff2?)', html))
    return sorted(urls)


def download(url: str) -> tuple[str, int, str]:
    import time

    rel = url.split("s.pinimg.com/webapp/", 1)[1]
    dest = VENDOR / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size:
        return rel, dest.stat().st_size, "cached"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    last_error = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            dest.write_bytes(data)
            return rel, len(data), "downloaded"
        except Exception as exc:  # transient CDN resets are common
            last_error = exc
            time.sleep(0.4 * (attempt + 1))
    return rel, 0, f"FAILED: {last_error}"


def main() -> None:
    html_path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/pinterest_home.html")
    urls = collect(html_path.read_text(encoding="utf-8", errors="replace"))
    print(f"Found {len(urls)} unique asset URLs")
    total = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        for rel, size, status in pool.map(download, urls):
            total += size
            print(f"  {status:10s} {size:>10,d}  {rel}")
    print(f"Total: {total:,} bytes in {VENDOR}")


if __name__ == "__main__":
    main()
