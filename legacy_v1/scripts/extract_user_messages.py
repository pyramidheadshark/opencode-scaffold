"""Extract user-only messages from Claude Code JSONL conversation history.

Usage:
    python scripts/extract_user_messages.py <project_dir> <output_file>
"""

import json
import sys
from pathlib import Path


def extract(project_dir: Path, output: Path) -> None:
    msgs = []
    jsonl_files = sorted(project_dir.glob("*.jsonl"))

    if not jsonl_files:
        print(f"No JSONL files found in {project_dir}")
        return

    for f in jsonl_files:
        try:
            raw = f.read_text(encoding="utf-8", errors="ignore")
        except OSError as e:
            print(f"  Skip {f.name}: {e}")
            continue

        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            if obj.get("type") != "user":
                continue
            if obj.get("isSidechain"):
                continue

            content = obj.get("message", {}).get("content", "")
            if isinstance(content, list):
                parts = []
                for c in content:
                    if isinstance(c, dict) and c.get("type") == "text":
                        parts.append(c.get("text", ""))
                content = " ".join(parts)

            text = content.strip()
            if not text:
                continue

            msgs.append(
                {
                    "ts": obj.get("timestamp", ""),
                    "session": obj.get("sessionId", "")[:8],
                    "text": text[:2000],
                }
            )

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(msgs, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Extracted {len(msgs)} user messages -> {output}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python extract_user_messages.py <project_dir> <output_file>")
        sys.exit(1)

    project_dir = Path(sys.argv[1])
    output = Path(sys.argv[2])

    if not project_dir.exists():
        print(f"Project dir not found: {project_dir}")
        sys.exit(1)

    extract(project_dir, output)
