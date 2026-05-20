from __future__ import annotations

import argparse
import os

from psycopg import connect


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean short-lived video feed data for small PostgreSQL plans.")
    parser.add_argument("--apply", action="store_true", help="Delete rows. Without this flag, only report counts.")
    parser.add_argument("--event-days", type=int, default=7)
    parser.add_argument("--non-video-days", type=int, default=14)
    parser.add_argument("--video-days", type=int, default=30)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("Missing DATABASE_URL environment variable.")

    statements = [
        (
            "feed_events",
            "DELETE FROM feed_events WHERE created_at < NOW() - (%s || ' days')::interval",
            "SELECT COUNT(*) FROM feed_events WHERE created_at < NOW() - (%s || ' days')::interval",
            (max(args.event_days, 1),),
        ),
        (
            "non_video_items",
            """
            DELETE FROM items
            WHERE video_url IS NULL
              AND stored_at < NOW() - (%s || ' days')::interval
            """,
            """
            SELECT COUNT(*) FROM items
            WHERE video_url IS NULL
              AND stored_at < NOW() - (%s || ' days')::interval
            """,
            (max(args.non_video_days, 1),),
        ),
        (
            "video_items",
            """
            DELETE FROM items
            WHERE video_url IS NOT NULL
              AND stored_at < NOW() - (%s || ' days')::interval
            """,
            """
            SELECT COUNT(*) FROM items
            WHERE video_url IS NOT NULL
              AND stored_at < NOW() - (%s || ' days')::interval
            """,
            (max(args.video_days, 1),),
        ),
    ]

    result: dict[str, int] = {}
    with connect(database_url, prepare_threshold=None) as conn:
        with conn.cursor() as cur:
            for name, delete_sql, count_sql, params in statements:
                if args.apply:
                    cur.execute(delete_sql, params)
                    result[name] = cur.rowcount
                else:
                    cur.execute(count_sql, params)
                    result[name] = cur.fetchone()[0]
        if args.apply:
            conn.commit()
        else:
            conn.rollback()

    print({"apply": args.apply, "deleted": result})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
