from __future__ import annotations

import unittest
from datetime import datetime, timezone

from collector.tikporn_source import parse_tikporn_datetime, playback_expiry


class TikPornSourceTest(unittest.TestCase):
    def test_playback_expiry_reads_epoch_path_segment(self):
        self.assertEqual(
            playback_expiry(["https://video-cdn.tik.porn/videos/a/b/1780925014/master.m3u8"]),
            datetime(2026, 6, 8, 13, 23, 34, tzinfo=timezone.utc),
        )

    def test_playback_expiry_returns_none_without_refresh_time(self):
        self.assertIsNone(playback_expiry(["https://video-cdn.tik.porn/videos/a/b/master.m3u8"]))

    def test_parse_tikporn_datetime_treats_naive_api_values_as_utc(self):
        self.assertEqual(
            parse_tikporn_datetime("2026-06-08 09:20:00"),
            datetime(2026, 6, 8, 9, 20, tzinfo=timezone.utc),
        )


if __name__ == "__main__":
    unittest.main()
