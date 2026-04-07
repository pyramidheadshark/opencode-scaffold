#!/usr/bin/env python3
"""
Verifies that Anthropic SDK is installed and ANTHROPIC_API_KEY is configured.
Run before the benchmark: python scripts/benchmark/check_sdk.py
"""
import os
import sys

# Fix Windows cp1251 encoding for Unicode symbols
if sys.stdout.encoding and sys.stdout.encoding.lower() in ("cp1251", "cp1252", "ascii"):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


def check_import():
    try:
        import anthropic
        return anthropic.__version__
    except ImportError:
        return None


def check_api_key():
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        return None
    masked = key[:8] + "..." + key[-4:] if len(key) > 12 else "***"
    return masked


def check_api_call(version):
    import anthropic
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=10,
        messages=[{"role": "user", "content": "Say OK"}],
    )
    usage = response.usage
    return {
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
        "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", 0),
        "cache_creation_input_tokens": getattr(usage, "cache_creation_input_tokens", 0),
    }


def main():
    ok = True

    version = check_import()
    if version:
        print(f"[✓] anthropic SDK imported (version {version})")
    else:
        print("[✗] anthropic SDK not found — run: pip install anthropic")
        sys.exit(1)

    key_masked = check_api_key()
    if key_masked:
        print(f"[✓] ANTHROPIC_API_KEY found ({key_masked})")
    else:
        print("[✗] ANTHROPIC_API_KEY not set — export ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)

    print("[~] Making test API call to claude-haiku-4-5-20251001...")
    try:
        usage = check_api_call(version)
        print("[✓] API call succeeded")
        print("\nUsage fields available:")
        max_key = max(len(k) for k in usage)
        for k, v in usage.items():
            note = "  (0 = caching not active — expected)" if k.startswith("cache") and v == 0 else ""
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
