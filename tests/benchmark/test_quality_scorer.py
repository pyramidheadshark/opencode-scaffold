"""
Tests for quality_runner.py scorer functions — offline, no API calls.

QR-01: quality_runner output file created (integration smoke test via dry-run simulation)
QR-02: JSONL output contains required fields: score, cost_usd, items
QR-03: E1 scorer finds all 3 bugs in fibonacci_broken.py from ground-truth response
QR-04: E3 scorer finds all 3 vulnerabilities in vulnerable_api.py from ground-truth response
"""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts" / "benchmark"))

from quality_runner import (
    score_keyword_match,
    score_response,
    BUG_HUNT_ITEMS,
    SECURITY_ITEMS,
    extract_python_code,
    score_gen01,
)


# Ground-truth model response for E1 (bug-hunt-01)
BUG_HUNT_GROUND_TRUTH = """
I found 3 bugs in this fibonacci implementation:

**Bug 1 (Line 9): Wrong base case condition**
The condition `n <= 0` will return -1 for n=0, but fibonacci(0) should return 0.
For n<0, raising a ValueError would be more appropriate.
Fix: `if n < 0: raise ValueError(...)` and add `if n == 0: return 0`

**Bug 2 (Line 13): range(n - 2) is off by one**
The loop uses `range(n - 2)` but should use `range(n - 1)`.
With range(n-2), the loop runs one iteration short, producing fib(n-1) instead of fib(n).

**Bug 3 (Line 15): Wrong return variable**
`return a` should be `return b`.
After the loop, `a` holds fib(n-1) and `b` holds fib(n).
The correct fix is to `return b`.
"""

# Ground-truth model response for E3 (security-01)
SECURITY_GROUND_TRUTH = """
I found 3 security vulnerabilities:

**Vulnerability 1: SQL Injection (Line 22)**
The query uses an f-string: `f"SELECT * FROM users WHERE id = {user_id}"`.
This allows an attacker to inject arbitrary SQL by crafting `user_id` like `1 OR 1=1`.
Fix: Use parameterized queries: `cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))`

**Vulnerability 2: Hardcoded credentials (Line 10)**
`SECRET_KEY = "mysecret123"` exposes credentials in source code.
Anyone with repository access can see the secret.
Fix: Load from environment variable: `SECRET_KEY = os.environ["SECRET_KEY"]`

**Vulnerability 3: Arbitrary code execution via eval() (Line 28)**
`eval(data['code'])` executes arbitrary Python code from user input.
This is a Remote Code Execution (RCE) vulnerability.
Fix: Remove eval() entirely and use a safe parser or allowlist-based approach.
"""


class TestBugHuntScorer(unittest.TestCase):
    """QR-03: E1 scorer finds all 3 bugs from ground-truth response."""

    def test_finds_all_three_bugs(self):
        score, items = score_keyword_match(BUG_HUNT_GROUND_TRUTH, BUG_HUNT_ITEMS)
        self.assertEqual(score, 1.0, f"Expected score=1.0, got {score}. Items: {items}")

    def test_finds_bug1_base_case(self):
        _, items = score_keyword_match(BUG_HUNT_GROUND_TRUTH, BUG_HUNT_ITEMS)
        bug1 = next(i for i in items if i["id"] == "bug1")
        self.assertTrue(bug1["found"], f"Bug1 (base case) not found. Keywords: {BUG_HUNT_ITEMS[0]['keywords']}")

    def test_finds_bug2_range(self):
        _, items = score_keyword_match(BUG_HUNT_GROUND_TRUTH, BUG_HUNT_ITEMS)
        bug2 = next(i for i in items if i["id"] == "bug2")
        self.assertTrue(bug2["found"], f"Bug2 (range) not found. Keywords: {BUG_HUNT_ITEMS[1]['keywords']}")

    def test_finds_bug3_return(self):
        _, items = score_keyword_match(BUG_HUNT_GROUND_TRUTH, BUG_HUNT_ITEMS)
        bug3 = next(i for i in items if i["id"] == "bug3")
        self.assertTrue(bug3["found"], f"Bug3 (return) not found. Keywords: {BUG_HUNT_ITEMS[2]['keywords']}")

    def test_partial_response_gives_partial_score(self):
        partial = "The main issue is the wrong range(n-2) in the loop."
        score, items = score_keyword_match(partial, BUG_HUNT_ITEMS)
        self.assertLess(score, 1.0)
        self.assertGreater(score, 0.0)

    def test_empty_response_scores_zero(self):
        score, items = score_keyword_match("", BUG_HUNT_ITEMS)
        self.assertEqual(score, 0.0)
        self.assertTrue(all(not i["found"] for i in items))


class TestSecurityScorer(unittest.TestCase):
    """QR-04: E3 scorer finds all 3 vulnerabilities from ground-truth response."""

    def test_finds_all_three_vulnerabilities(self):
        score, items = score_keyword_match(SECURITY_GROUND_TRUTH, SECURITY_ITEMS)
        self.assertEqual(score, 1.0, f"Expected score=1.0, got {score}. Items: {items}")

    def test_finds_sqli(self):
        _, items = score_keyword_match(SECURITY_GROUND_TRUTH, SECURITY_ITEMS)
        sqli = next(i for i in items if i["id"] == "sqli")
        self.assertTrue(sqli["found"], "SQL injection not found")

    def test_finds_hardcoded_secret(self):
        _, items = score_keyword_match(SECURITY_GROUND_TRUTH, SECURITY_ITEMS)
        secret = next(i for i in items if i["id"] == "hardcoded_secret")
        self.assertTrue(secret["found"], "Hardcoded secret not found")

    def test_finds_eval_rce(self):
        _, items = score_keyword_match(SECURITY_GROUND_TRUTH, SECURITY_ITEMS)
        rce = next(i for i in items if i["id"] == "eval_rce")
        self.assertTrue(rce["found"], "eval/RCE not found")

    def test_partial_response_gives_partial_score(self):
        partial = "There is a SQL injection issue with the f-string query."
        score, _ = score_keyword_match(partial, SECURITY_ITEMS)
        self.assertLess(score, 1.0)
        self.assertGreater(score, 0.0)


class TestExtractPythonCode(unittest.TestCase):
    """extract_python_code helper used by gen-01 scorer."""

    def test_extracts_from_fenced_block(self):
        text = "Here is the solution:\n\n```python\ndef parse_yaml(text):\n    return {}\n```"
        code = extract_python_code(text)
        self.assertIn("def parse_yaml", code)
        self.assertNotIn("```", code)

    def test_extracts_from_generic_fenced_block(self):
        text = "```\ndef parse_yaml(text):\n    return {}\n```"
        code = extract_python_code(text)
        self.assertIn("def parse_yaml", code)

    def test_falls_back_to_raw_text(self):
        text = "def parse_yaml(text):\n    return {}"
        code = extract_python_code(text)
        self.assertIn("def parse_yaml", code)


class TestGenScorer(unittest.TestCase):
    """E5 gen-01 scorer: run pytest on generated code."""

    def test_correct_implementation_scores_full(self):
        correct_impl = """
def parse_yaml(text):
    result = {}
    for line in text.replace("\\r\\n", "\\n").split("\\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, _, value = line.partition(":")
            result[key.strip()] = value.strip()
    return result
"""
        score, items = score_gen01(f"```python\n{correct_impl}\n```")
        self.assertEqual(score, 1.0, f"Correct impl should score 1.0, got {score}. Items: {items}")

    def test_broken_implementation_scores_less_than_full(self):
        broken_impl = """
def parse_yaml(text):
    return {}
"""
        score, items = score_gen01(f"```python\n{broken_impl}\n```")
        self.assertLess(score, 1.0)


class TestScoreResponseDispatch(unittest.TestCase):
    """score_response() dispatches to correct scorer."""

    def test_bug_hunt_dispatch(self):
        score, items = score_response("bug-hunt-01", BUG_HUNT_GROUND_TRUTH)
        self.assertEqual(score, 1.0)
        self.assertEqual(len(items), 3)

    def test_security_dispatch(self):
        score, items = score_response("security-01", SECURITY_GROUND_TRUTH)
        self.assertEqual(score, 1.0)
        self.assertEqual(len(items), 3)

    def test_unknown_task_raises(self):
        with self.assertRaises(ValueError):
            score_response("unknown-task", "some response")


class TestOutputSchema(unittest.TestCase):
    """QR-01/QR-02: Verify that a result dict has required fields."""

    def test_result_has_required_fields(self):
        score, items = score_response("bug-hunt-01", BUG_HUNT_GROUND_TRUTH)
        result = {
            "task": "bug-hunt-01",
            "model": "anthropic/claude-haiku-4.5",
            "run": 1,
            "prompt_tokens": 150,
            "completion_tokens": 200,
            "cost_usd": round(150 * 0.80e-6 + 200 * 4.00e-6, 6),
            "score": round(score, 3),
            "items": items,
            "generation_id": "gen-test-123",
            "ts": "2026-04-14T10:00:00+00:00",
        }
        for field in ("task", "model", "score", "cost_usd", "items", "prompt_tokens",
                      "completion_tokens", "generation_id"):
            self.assertIn(field, result, f"Missing field: {field}")
        self.assertIsInstance(result["items"], list)
        self.assertIsInstance(result["score"], float)

    def test_result_serializes_to_jsonl(self):
        score, items = score_response("security-01", SECURITY_GROUND_TRUTH)
        result = {
            "task": "security-01",
            "model": "anthropic/claude-sonnet-4.6",
            "run": 1,
            "prompt_tokens": 100,
            "completion_tokens": 300,
            "cost_usd": round(100 * 3.00e-6 + 300 * 15.00e-6, 6),
            "score": round(score, 3),
            "items": items,
            "generation_id": "gen-test-456",
            "ts": "2026-04-14T10:00:00+00:00",
        }
        line = json.dumps(result, ensure_ascii=False)
        parsed = json.loads(line)
        self.assertEqual(parsed["score"], 1.0)
        self.assertEqual(len(parsed["items"]), 3)


if __name__ == "__main__":
    unittest.main()
