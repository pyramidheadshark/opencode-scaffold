#!/usr/bin/env python3
"""
Verifies that OpenAI SDK is installed, OPENROUTER_API_KEY is configured,
and OpenRouter API responds correctly with usage fields.

Run before the benchmark: python scripts/benchmark/check_sdk.py
"""
import os
import sys

# Fix Windows cp1251 encoding for Unicode symbols
if sys.stdout.encoding and sys.stdout.encoding.lower() in ("cp1251", "cp1252", "ascii"):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
REFERER = "https://github.com/pyramidheadshark/claude-scaffold"
TITLE = "claude-scaffold benchmark"
TEST_MODEL = "anthropic/claude-haiku-4.5"


def check_import():
    try:
        import openai
        return openai.__version__
    except ImportError:
        return None


def check_api_key():
    key = os.getenv("OPENROUTER_API_KEY", "")
    if not key:
        return None
    masked = key[:12] + "..." + key[-4:] if len(key) > 16 else "***"
    return masked


def check_api_call():
    from openai import OpenAI
    client = OpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=os.environ["OPENROUTER_API_KEY"],
        default_headers={
            "HTTP-Referer": REFERER,
            "X-Title": TITLE,
        },
    )
    response = client.chat.completions.create(
        model=TEST_MODEL,
        max_tokens=10,
        messages=[{"role": "user", "content": "Say OK"}],
    )
    usage = response.usage
    details = getattr(usage, "prompt_tokens_details", None)
    cached = getattr(details, "cached_tokens", 0) if details else 0

    return {
        "generation_id": response.id,
        "model": response.model,
        "prompt_tokens": usage.prompt_tokens,
        "completion_tokens": usage.completion_tokens,
        "total_tokens": usage.total_tokens,
        "cached_tokens": cached or 0,
    }


def main():
    ok = True

    version = check_import()
    if version:
        print(f"[✓] openai SDK imported (version {version})")
    else:
        print("[✗] openai SDK not found — run: pip install openai")
        sys.exit(1)

    key_masked = check_api_key()
    if key_masked:
        print(f"[✓] OPENROUTER_API_KEY found ({key_masked})")
    else:
        print("[✗] OPENROUTER_API_KEY not set — export OPENROUTER_API_KEY=sk-or-v1-...")
        sys.exit(1)

    print(f"[~] Making test API call to {TEST_MODEL} via OpenRouter...")
    try:
        result = check_api_call()
        print("[✓] API call succeeded")
        print(f"\nResponse fields:")
        max_key = max(len(k) for k in result)
        for k, v in result.items():
            note = ""
            if k == "cached_tokens" and v == 0:
                note = "  (0 = no cache hit — expected on first call)"
            print(f"  {k:<{max_key + 2}} = {v}{note}")
    except Exception as e:
        print(f"[✗] API call failed: {e}")
        ok = False

    print()
    if ok:
        print("[✓] All checks passed. Ready for benchmark.")
        print("    Run: python scripts/benchmark/token_runner.py --mode baseline --dry-run")
    else:
        print("[✗] Some checks failed. Fix above errors before running benchmark.")
        sys.exit(1)


if __name__ == "__main__":
    main()
