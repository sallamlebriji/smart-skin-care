"""
Scan image storage. Phase 3 ships a local-disk implementation behind a small
interface so an S3/R2 backend (spec §2) can replace it without touching the API.
Files live outside any statically served directory: they are private by default.
"""

import json
import shutil
import os
import tempfile
from pathlib import Path
from typing import Protocol


class ScanStorage(Protocol):
    def save_image(self, scan_id: str, angle: str, data: bytes, ext: str) -> str: ...
    def load_image(self, scan_id: str, filename: str) -> bytes | None: ...
    def save_meta(self, scan_id: str, meta: dict) -> None: ...
    def load_meta(self, scan_id: str) -> dict | None: ...
    def delete_scan(self, scan_id: str) -> bool: ...


class LocalScanStorage:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _dir(self, scan_id: str) -> Path:
        # scan ids are generated server-side; still refuse anything path-like.
        if not scan_id.replace("_", "").isalnum():
            raise ValueError("invalid scan id")
        return self.root / scan_id

    def save_image(self, scan_id: str, angle: str, data: bytes, ext: str) -> str:
        d = self._dir(scan_id)
        d.mkdir(parents=True, exist_ok=True)
        name = f"{angle}.{ext}"
        (d / name).write_bytes(data)
        return name

    def load_image(self, scan_id: str, filename: str) -> bytes | None:
        try:
            path = self._dir(scan_id) / filename
        except ValueError:
            return None
        # filename always comes from our own meta.json (e.g. "front.jpg"), but
        # refuse traversal defensively rather than trust that invariant blindly.
        if "/" in filename or "\\" in filename or ".." in filename or not path.exists():
            return None
        return path.read_bytes()

    def save_meta(self, scan_id: str, meta: dict) -> None:
        d = self._dir(scan_id)
        d.mkdir(parents=True, exist_ok=True)
        # Readers see a complete old or new document, never a half-written result.
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=d, delete=False) as handle:
                temporary = Path(handle.name)
                json.dump(meta, handle, indent=2)
            os.replace(temporary, d / "meta.json")
        finally:
            if temporary:
                temporary.unlink(missing_ok=True)

    def load_meta(self, scan_id: str) -> dict | None:
        try:
            path = self._dir(scan_id) / "meta.json"
        except ValueError:
            return None
        if not path.exists():
            return None
        meta = json.loads(path.read_text(encoding="utf-8"))
        if meta.get("result") and meta.get("created_at"):
            meta["result"].setdefault("created_at", meta["created_at"])
        return meta

    def delete_scan(self, scan_id: str) -> bool:
        try:
            d = self._dir(scan_id)
        except ValueError:
            return False
        if not d.exists():
            return False
        shutil.rmtree(d)
        return True
