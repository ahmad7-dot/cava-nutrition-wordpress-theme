from app.niches import default_edit_settings, merge_edit_settings
from app.pipeline.captions import build_ass, to_srt
from app.pipeline.render import KeepSegment, map_words
from app.pipeline.scoring import CRITERIA, heuristic_breakdown, overall
from app.pipeline.segments import build_sentences, candidate_windows
from app.providers.llm import AnalysisResult, HeuristicProvider, SelectionRequest, _strict_schema
from tests.conftest import fake_transcript


def test_sentences_follow_punctuation():
    s = build_sentences(fake_transcript())
    assert len(s) == 13
    assert s[0].text.startswith("Here's the secret") and s[0].text.endswith("business.")


def test_windows_start_and_end_on_sentences():
    s = build_sentences(fake_transcript())
    wins = candidate_windows(s, 15)
    assert wins
    for w in wins:
        assert w.text.endswith((".", "?", "!"))
        assert 15 * 0.65 <= w.duration <= 15 * 1.35


def test_score_bounds_and_weights():
    assert abs(sum(w for _, w in CRITERIA.values()) - 1.0) < 1e-9
    b = heuristic_breakdown("Here's the secret nobody tells you. It changed everything!", 10)
    assert 0 <= overall(b) <= 100
    weak = heuristic_breakdown("and um so like yeah he said that thing", 10)
    assert overall(b) > overall(weak)


def test_heuristic_provider_returns_non_overlapping_clips():
    s = build_sentences(fake_transcript())
    req = SelectionRequest(title="Founder talk", niche="business", niche_focus="", language="en",
                           platforms=["tiktok"], desired_clips=3, min_duration=10, max_duration=30)
    res = HeuristicProvider().select_clips(req, s)
    assert 1 <= len(res.clips) <= 3
    spans = sorted((s[c.first_sentence].start, s[c.last_sentence].end) for c in res.clips)
    assert all(a[1] <= b[0] for a, b in zip(spans, spans[1:]))
    assert all(len(c.alt_hooks) == 3 for c in res.clips)


def test_strict_schema_is_closed():
    schema = _strict_schema(AnalysisResult.model_json_schema())
    clip = schema["properties"]["clips"]["items"]
    assert clip["additionalProperties"] is False
    assert "title" in clip["required"] and "scores" in clip["required"]
    assert "$ref" not in str(schema)


def test_silence_mapping_drops_and_shifts_words():
    words = [{"start": 1.0, "end": 1.5, "word": "a"}, {"start": 3.0, "end": 3.4, "word": "b"},
             {"start": 6.0, "end": 6.5, "word": "c"}]
    segs = [KeepSegment(0.5, 2.0, 0.0), KeepSegment(5.5, 7.0, 1.5)]
    out = map_words(words, segs)
    assert [w["word"] for w in out] == ["a", "c"]
    assert out[1]["start"] == 2.0


def test_ass_contains_highlight_and_hook():
    words = [{"start": 0.0, "end": 0.4, "word": "Two"}, {"start": 0.4, "end": 0.9, "word": "million."}]
    ass = build_ass(words, default_edit_settings("business")["captions"], 1080, 1920, hook="The rule",
                    hook_seconds=2)
    assert "Style: Caption" in ass and "The rule" in ass and "\\1c" in ass
    assert "1\n00:00:00,000 --> 00:00:00,900" in to_srt(words)


def test_edit_settings_merge():
    base = default_edit_settings("podcast")
    merged = merge_edit_settings(base, {"captions": {"font_size": 90}, "layout": "blur"})
    assert merged["captions"]["font_size"] == 90 and merged["captions"]["style"] == base["captions"]["style"]
    assert merged["layout"] == "blur"
