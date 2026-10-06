#!/usr/bin/env python3
"""Back up the local CRM PostgreSQL database outside the repository."""
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from stat import S_IMODE
from urllib.parse import unquote, urlparse

repository = Path(__file__).resolve().parents[1]
database_url = os.environ.get("DATABASE_URL", "")
parsed = urlparse(database_url)
if parsed.scheme not in ("postgresql", "postgres") or parsed.hostname not in ("127.0.0.1", "localhost", "::1"):
    raise SystemExit("只可備份本機 PostgreSQL；請先載入私有 local.env")

destination = Path(os.environ.get("FIELDDESK_BACKUP_DIR", str(Path.home() / "Library/Application Support/FieldDesk/backups"))).expanduser().resolve()
if destination == repository or repository in destination.parents:
    raise SystemExit("備份目錄必須在 repository 以外")
if destination.exists():
    if not destination.is_dir() or S_IMODE(destination.stat().st_mode) & 0o077:
        raise SystemExit("備份目錄必須是只有目前使用者可存取的私有資料夾")
else:
    destination.mkdir(parents=True, mode=0o700)
    destination.chmod(0o700)

database_name = unquote(parsed.path.lstrip("/"))
if not database_name or not parsed.username:
    raise SystemExit("DATABASE_URL 缺少資料庫名稱或使用者")
pg_bin = Path(os.environ.get("FIELDDESK_PG_BIN", "/usr/local/opt/postgresql@17/bin"))
pg_dump = pg_bin / "pg_dump"
if not pg_dump.is_file():
    raise SystemExit("找不到 PostgreSQL pg_dump")

timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = destination / f"fielddesk-{database_name}-{timestamp}.dump"
environment = os.environ.copy()
environment.update({
    "PGHOST": parsed.hostname,
    "PGPORT": str(parsed.port or 5432),
    "PGUSER": unquote(parsed.username),
    "PGDATABASE": database_name,
    "PGPASSWORD": unquote(parsed.password or ""),
})

created = False
try:
    descriptor = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    created = True
    with os.fdopen(descriptor, "wb") as output:
        subprocess.run([str(pg_dump), "--format=custom", "--no-owner", "--no-acl"], env=environment, stdout=output, check=True)
except Exception:
    if created:
        backup.unlink(missing_ok=True)
    raise

print(f"備份完成：{backup}")
