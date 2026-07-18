import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from update_digest import canonicalize_url, dedupe_candidates, is_recent_enough, normalize_selected, prepare_prompt_candidates, title_similarity
from datetime import datetime, timezone


class DedupeTests(unittest.TestCase):
    def test_tracking_parameters_do_not_create_new_item(self):
        left = canonicalize_url("https://example.com/report?utm_source=x&id=42")
        right = canonicalize_url("https://www.example.com/report?id=42&utm_campaign=daily")
        self.assertEqual(left, right)

    def test_youtube_urls_normalize_to_video_id(self):
        left = canonicalize_url("https://youtu.be/abc123?si=xyz")
        right = canonicalize_url("https://www.youtube.com/watch?v=abc123&utm_source=test")
        self.assertEqual(left, right)

    def test_x_status_urls_normalize(self):
        left = canonicalize_url("https://twitter.com/user/status/123456?ref=test")
        right = canonicalize_url("https://x.com/another/status/123456")
        self.assertEqual(left, right)

    def test_title_similarity_catches_rewrites(self):
        left = "Phase 3 epilepsy trial reports topline seizure reduction results"
        right = "Topline seizure reduction results reported in phase 3 epilepsy trial"
        self.assertGreaterEqual(title_similarity(left, right), 0.9)

    def test_candidate_pool_deduplicates_same_event_title(self):
        items = [
            {"title": "New stroke guideline updates thrombolysis window", "url": "https://a.example/1"},
            {"title": "Stroke guideline updates the thrombolysis window", "url": "https://b.example/2"},
        ]
        self.assertEqual(len(dedupe_candidates(items)), 1)

    def test_prompt_pool_preserves_special_sources(self):
        items = [
            {
                "title": f"News {index}", "url": f"https://news.example/{index}",
                "source_type": "news", "lane_hint": "ai_clinical", "published_at": "2026-07-18",
            }
            for index in range(30)
        ]
        items.extend([
            {
                "title": "Video signal", "url": "https://youtube.com/watch?v=abc",
                "source_type": "youtube", "lane_hint": "neuro", "published_at": "2026-07-18",
            },
            {
                "title": "Social signal", "url": "https://x.com/i/status/123",
                "source_type": "x", "lane_hint": "neuro", "published_at": "2026-07-18",
            },
        ])
        prepared = prepare_prompt_candidates(items, max_items=12)
        self.assertIn("youtube", {item["source_type"] for item in prepared})
        self.assertIn("x", {item["source_type"] for item in prepared})

    def test_future_publication_is_rejected(self):
        now = datetime(2026, 7, 18, tzinfo=timezone.utc)
        self.assertFalse(is_recent_enough("2026-12-31", now, False))
        self.assertTrue(is_recent_enough("2026-07-17", now, False))

    def test_first_report_cannot_claim_to_be_history_update(self):
        now = datetime(2026, 7, 18, tzinfo=timezone.utc)
        raw = {
            "lane": "neuro", "topic": "脑卒中", "title_zh": "首次结果", "original_title": "First result",
            "source_name": "Journal", "source_url": "https://example.com/new", "source_type": "journal",
            "published_at": "2026-07-17", "fact": "事实", "why_it_matters": "相关性", "interpretation": "解释",
            "clinical_research_implication": "落点", "confidence": "高", "evidence_grade": "同行评议研究",
            "event_key": "first-result-2026", "is_substantive_update": True, "update_note": "首次披露结果",
        }
        selected = normalize_selected([raw], [], now)
        self.assertFalse(selected[0]["is_substantive_update"])
        self.assertEqual(selected[0]["update_note"], "")

    def test_user_relevant_clinical_ai_ranks_above_generic_ai(self):
        items = [
            {
                "title": "AI model for corneal imaging", "url": "https://example.com/eye",
                "source_type": "pubmed", "lane_hint": "ai_clinical", "published_at": "2026-07-18",
            },
            {
                "title": "Wearable machine learning endpoint for Parkinson clinical trial safety monitoring",
                "url": "https://example.com/neuro", "source_type": "pubmed", "lane_hint": "ai_clinical",
                "published_at": "2026-07-17",
            },
        ]
        prepared = prepare_prompt_candidates(items, max_items=1)
        self.assertEqual(prepared[0]["url"], "https://example.com/neuro")


if __name__ == "__main__":
    unittest.main()
