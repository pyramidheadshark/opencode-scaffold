# Windows Developer Guide

## When to Load

Automatically loaded on Windows (`platform_trigger: "win32"`).
Applies to: `.py`, `.ps1`, `.bat`, `.cmd` files and any Windows-specific workflow.

## Python on Windows

### Encoding (CRITICAL)

Windows defaults to `cp1251` / `cp1252` for file I/O. Always specify UTF-8 explicitly:

```python
with open("file.txt", "r", encoding="utf-8") as f:
    content = f.read()

Path("file.txt").read_text(encoding="utf-8")
Path("file.txt").write_text(content, encoding="utf-8")

import json
json.load(open("data.json", encoding="utf-8"))
```

At script entry point, reconfigure stdout:

```python
import sys
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
```

For subprocess calls:

```python
subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
```

### Python Command

Use `python` (not `python3`) on Windows. The `python3` alias is not reliably available.

```bash
python -m pytest tests/
python -m pip install -e .
python scripts/run.py
```

### Path Handling

Use `pathlib.Path` or `os.path` — never hardcode forward/backslashes:

```python
from pathlib import Path
config = Path(__file__).parent / "config" / "settings.json"
```

## Terminal Encoding

### Git Bash (Preferred for Claude Code)

Git Bash handles UTF-8 well by default. Recommended as primary shell.

### CMD / PowerShell

Set code page to UTF-8 before running scripts:

```cmd
chcp 65001
```

PowerShell profile setup:

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
```

### Environment Variable

Set globally for consistent behavior:

```powershell
[Environment]::SetEnvironmentVariable("PYTHONIOENCODING", "utf-8", "User")
```

## Common Windows Pitfalls

1. **File locking**: Windows locks open files — close handles before rename/delete
2. **Max path length**: Enable long paths via Group Policy or registry if paths exceed 260 chars
3. **Line endings**: Configure git: `git config core.autocrlf true`
4. **Temp files**: Use `tempfile.NamedTemporaryFile(delete=False)` — Windows cannot open a temp file while it's held
5. **Process cleanup**: Use `taskkill /F /PID` instead of `kill -9`
6. **Permission errors on rmtree**: Use `onerror` handler for read-only files:

```python
import shutil, stat
def rm_readonly(func, path, _):
    os.chmod(path, stat.S_IWRITE)
    func(path)
shutil.rmtree(dir_path, onerror=rm_readonly)
```
