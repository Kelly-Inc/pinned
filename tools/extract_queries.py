#!/usr/bin/env python3
"""Extract compiled Relay query/mutation metadata from vendored Pinterest bundles."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
VENDOR = ROOT / "vendor"
OUT = ROOT / "tools" / "query_catalog.json"

ID_PATTERN = re.compile(r'params:\{id:"(?P<id>[0-9a-f]{64})"')
NAME_PATTERN = re.compile(r'name:"(?P<name>[A-Za-z0-9_]+)"')


def main() -> None:
    catalog: dict[str, dict] = {}
    for path in sorted(VENDOR.rglob("*.mjs")):
        text = path.read_text(encoding="utf-8", errors="replace")
        for match in ID_PATTERN.finditer(text):
            qid = match.group("id")
            name_match = NAME_PATTERN.search(text, match.end(), match.end() + 800)
            if not name_match:
                continue
            name = name_match.group("name")
            item = catalog.setdefault(name, {"id": qid, "files": []})
            rel = str(path.relative_to(ROOT))
            if rel not in item["files"]:
                item["files"].append(rel)
    OUT.write_text(json.dumps(catalog, indent=2, sort_keys=True) + "\n")
    print(f"Catalogued {len(catalog)} operations -> {OUT}")
    for name in sorted(catalog):
        if re.search(r"home|feed|search|closeup|board|pin", name, re.I):
            print(f"  {name:65s} {catalog[name]['id'][:16]}")


if __name__ == "__main__":
    main()
