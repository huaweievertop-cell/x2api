from __future__ import annotations

import os
import sys
from pathlib import Path

from psycopg import connect
from psycopg.rows import dict_row

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from collector.twitter_monitor import parse_datetime  # noqa: E402


def main() -> int:
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("Missing DATABASE_URL environment variable.")

    skipped = 0

    with connect(database_url, row_factory=dict_row, prepare_threshold=None) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, metadata->>'published_raw' AS published_raw
                FROM items
                WHERE published_at IS NULL
                  AND metadata ? 'published_raw'
                  AND COALESCE(metadata->>'published_raw', '') <> ''
                """
            )
            rows = cur.fetchall()

        updates: list[tuple[object, str]] = []
        for row in rows:
            parsed = parse_datetime(row["published_raw"])
            if not parsed:
                skipped += 1
                continue
            updates.append((parsed, row["id"]))

        with conn.cursor() as cur:
            cur.executemany(
                """
                UPDATE items
                SET published_at = %s
                WHERE id = %s
                """,
                updates,
            )

        conn.commit()

    print(
        {
            "checked": len(rows),
            "updated": len(updates),
            "skipped": skipped,
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
