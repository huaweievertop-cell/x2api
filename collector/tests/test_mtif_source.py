from __future__ import annotations

import unittest
from unittest.mock import patch

from Crypto.Cipher import AES

from collector.mtif_source import (
    aes_iv_for_segment,
    decrypt_aes128_chunk,
    iter_video_cards,
    looks_like_media_segment,
    normalize_mtif_target_value,
    parse_app_data,
    parse_detail_page,
    parse_list_page,
    reject_ad_url,
)


class MtifSourceTests(unittest.TestCase):
    def test_parse_list_page_reads_window_app_data(self):
        html = """
        <html><body><script>
        window.APP_DATA = [{"type":"video_list","data":[
          {"short_id":"abc123","title":"Sample title","duration":120,"thumbnail":"abc/index.jpg.js"}
        ]}];
        </script></body></html>
        """
        with patch("collector.mtif_source.fetch_html", return_value=html):
            items = parse_list_page("https://1mtif.sbs", 1)

        self.assertEqual(items[0]["guid"], "1mtif:abc123")
        self.assertEqual(items[0]["url"], "https://1mtif.sbs/play/abc123")
        self.assertEqual(items[0]["title"], "Sample title")

    def test_parse_detail_page_uses_configured_media_host(self):
        html = """
        <script>
        window.APP_DATA = {"data":{
          "short_id":"abc123",
          "title":"Sample title",
          "duration":120,
          "server":"s3",
          "m3u8":"abc/video.m3u8",
          "thumbnail":"abc/index_origin.jpg.js",
          "tags":[{"Name":"tag1"}]
        }};
        </script>
        """
        config = {
            "site_name": "蜜桃视频",
            "m3u8_hosts": {"default": "https://media.example/", "s3": "https://cdn.example/"},
            "pic_host": "https://media.example/",
        }
        with patch("collector.mtif_source.fetch_config", return_value=config), patch("collector.mtif_source.fetch_html", return_value=html):
            detail = parse_detail_page("https://1mtif.sbs/play/abc123")

        self.assertEqual(detail["video_id"], "abc123")
        self.assertEqual(detail["players"][0]["video_url"], "https://cdn.example/abc/video.m3u8")
        self.assertEqual(detail["players"][0]["allowed_media_hosts"], {"media.example", "cdn.example"})
        self.assertEqual(detail["image"], "https://media.example/abc/index_origin.jpg.js")
        self.assertEqual(detail["tags"], ["tag1"])

    def test_reject_ad_url_blocks_known_banner_hosts(self):
        with self.assertRaises(ValueError):
            reject_ad_url("https://adhh.yaknd.example/banner.gif", "banner")

    def test_aes_decrypt_probe_recognizes_encrypted_ts_bytes(self):
        key = b"0123456789abcdef"
        sequence = 7
        plain = bytearray(384)
        plain[0] = 0x47
        plain[188] = 0x47
        cipher = AES.new(key, AES.MODE_CBC, aes_iv_for_segment(sequence, None))
        encrypted = cipher.encrypt(bytes(plain))

        decrypted = decrypt_aes128_chunk(encrypted, key, sequence, None)

        self.assertTrue(looks_like_media_segment(decrypted))

    def test_normalize_target_value_drops_paths(self):
        self.assertEqual(normalize_mtif_target_value("https://1mtif.sbs/type/2"), "https://1mtif.sbs")

    def test_iter_video_cards_walks_nested_app_data(self):
        data = parse_app_data('''<script>window.APP_DATA = {"data":[{"data":{"short_id":"abc","title":"Title"}}]};</script>''')
        cards = iter_video_cards(data)
        self.assertEqual(cards[0]["short_id"], "abc")


if __name__ == "__main__":
    unittest.main()
