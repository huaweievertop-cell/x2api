from __future__ import annotations

import os
import re
from pathlib import Path

from psycopg import connect


def split_sql(sql: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    in_dollar_quote = False
    dollar_tag = ""

    for line in sql.splitlines():
        search_pos = 0
        while True:
            if in_dollar_quote:
                end = line.find(dollar_tag, search_pos)
                if end == -1:
                    break
                search_pos = end + len(dollar_tag)
                in_dollar_quote = False
                dollar_tag = ""
                continue

            match = re.search(r"\$[A-Za-z_0-9]*\$", line[search_pos:])
            if not match:
                break
            dollar_tag = match.group(0)
            in_dollar_quote = True
            search_pos += match.end()

        current.append(line)
        if not in_dollar_quote and line.rstrip().endswith(";"):
            statement = "\n".join(current).strip()
            if statement:
                statements.append(statement)
            current = []

    tail = "\n".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


def main() -> int:
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("Missing DATABASE_URL environment variable.")

    schema_path = Path(__file__).resolve().parent.parent / "shared" / "schema.sql"
    statements = split_sql(schema_path.read_text(encoding="utf-8"))

    with connect(database_url, prepare_threshold=None) as conn:
        with conn.cursor() as cur:
            for statement in statements:
                cur.execute(statement)
        conn.commit()

    print({"applied_statements": len(statements)})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
