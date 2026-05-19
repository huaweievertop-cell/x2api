from __future__ import annotations

import unittest
from datetime import timezone

from collector.twitter_monitor import parse_datetime


class ParseDatetimeTest(unittest.TestCase):
    def test_parses_iso8601(self):
        parsed = parse_datetime("2026-05-19T14:55:03.652155+00:00")
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.isoformat(), "2026-05-19T14:55:03.652155+00:00")

    def test_parses_nitter_datetime(self):
        parsed = parse_datetime("Jan 20, 2026 · 11:27 AM UTC")
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.tzinfo, timezone.utc)
        self.assertEqual(parsed.isoformat(), "2026-01-20T11:27:00+00:00")

    def test_invalid_value_returns_none(self):
        self.assertIsNone(parse_datetime("not-a-date"))


if __name__ == "__main__":
    unittest.main()
