#!/usr/bin/env python3
"""Generate asciinema cast file for claude-scaffold demo."""
import json
import time as time_module

WIDTH = 100
HEIGHT = 28

events = []
t = 0.0

def out(text, delay=0.0):
    global t
    t += delay
    events.append([round(t, 4), "o", text])

def type_chars(text, speed=0.07):
    global t
    for ch in text:
        t += speed
        events.append([round(t, 4), "o", ch])

def nl():
    out("\r\n")

def pause(s):
    global t
    t += s

# ANSI helpers
RESET   = "\x1b[0m"
BOLD    = "\x1b[1m"
DIM     = "\x1b[2m"
GREEN   = "\x1b[32m"
CYAN    = "\x1b[36m"
YELLOW  = "\x1b[33m"
BLUE    = "\x1b[34m"
MAGENTA = "\x1b[35m"
WHITE   = "\x1b[97m"
GREY    = "\x1b[90m"

PROMPT = f"{BOLD}{GREEN}user@dev{RESET}{WHITE}:{BOLD}{BLUE}~/cs-demo{RESET}$ {RESET}"

# === Scene 0: initial pause + padding ===
pause(0.5)
out("\r\n\r\n")

# === Scene 1: show empty dir ===
out(PROMPT)
pause(0.6)
type_chars("ls -la", speed=0.07)
pause(0.4)
out("\r\n")
out(f"total 0\r\n")
out(f"drwxr-xr-x  3 user user   60 Mar 20 22:00 {BOLD}.{RESET}\r\n")
out(f"drwxr-xr-x 42 user user 4096 Mar 20 22:00 {BOLD}..{RESET}\r\n")
out(f"drwxr-xr-x  7 user user  140 Mar 20 22:00 {BOLD}{BLUE}.git{RESET}\r\n")
pause(1.0)
nl()

# === Scene 2: run init ===
out(PROMPT)
pause(0.4)
type_chars("claude-scaffold init . --profile ml-engineer --lang en", speed=0.055)
pause(0.5)
out("\r\n")
pause(0.3)

# Init output
SEP = f"{DIM}------------------------------------------------------------{RESET}"
out(f"{SEP}\r\n")
out(f"  {BOLD}{CYAN}claude-scaffold{RESET} {WHITE}:: Deploy{RESET}\r\n")
out(f"{SEP}\r\n")
pause(0.15)
out(f"  {DIM}Target {RESET} : {WHITE}~/cs-demo{RESET}\r\n")
pause(0.1)

skills = [
    "python-project-standards",
    "ml-data-handling",
    "predictive-analytics",
    "experiment-tracking",
    "rag-vector-db",
    "langgraph-patterns",
    "test-first-patterns",
]
row1 = ", ".join(f"{CYAN}{s}{RESET}" for s in skills[:4])
row2 = ", ".join(f"{CYAN}{s}{RESET}" for s in skills[4:])
out(f"  {DIM}Skills {RESET} : {row1},\r\n")
out(f"           {row2}\r\n")
pause(0.1)
out(f"  {DIM}Lang   {RESET} : {WHITE}en{RESET}\r\n")
pause(0.1)
out(f"  {DIM}CI     {RESET} : {DIM}none{RESET}\r\n")
nl()
pause(0.8)

# Deploying files animation
files = [
    (".claude/CLAUDE.md",                           "CLAUDE.md"),
    (".claude/hooks/session-start.js",              "session-start hook"),
    (".claude/hooks/skill-activation-prompt.js",    "skill-activation hook"),
    (".claude/hooks/python-quality-check.js",       "quality-check hook"),
    (".claude/skills/python-project-standards.md",  "skill: python-project-standards"),
    (".claude/skills/ml-data-handling.md",          "skill: ml-data-handling"),
    (".claude/skills/predictive-analytics.md",      "skill: predictive-analytics"),
    (".claude/skills/experiment-tracking.md",       "skill: experiment-tracking"),
    (".claude/skills/rag-vector-db.md",             "skill: rag-vector-db"),
    (".claude/skills/langgraph-patterns.md",        "skill: langgraph-patterns"),
    (".claude/skills/test-first-patterns.md",       "skill: test-first-patterns"),
    ("dev/status.md",                               "dev/status.md"),
    (".gitignore",                                  ".gitignore"),
]

CHECK = f"{BOLD}{GREEN}✓{RESET}"

for path, label in files:
    pause(0.08)
    out(f"  {CHECK}  {DIM}{path}{RESET}\r\n")

pause(0.3)
nl()
out(f"{SEP}\r\n")
out(f"  {BOLD}{GREEN}Done!{RESET}\r\n")
out(f"{SEP}\r\n")
pause(1.5)
nl()

# === Scene 3: show what was deployed ===
out(PROMPT)
pause(0.5)
type_chars("ls .claude/", speed=0.07)
pause(0.4)
out("\r\n")
out(f"{BOLD}{BLUE}agents{RESET}   {BOLD}{BLUE}cache{RESET}   {BOLD}{BLUE}commands{RESET}   CLAUDE.md   {BOLD}{BLUE}hooks{RESET}   {BOLD}{BLUE}logs{RESET}   {BOLD}{BLUE}skills{RESET}\r\n")
pause(1.2)
nl()

out(PROMPT)
pause(0.4)
type_chars("ls .claude/skills/", speed=0.07)
pause(0.4)
out("\r\n")

skill_files = [
    "experiment-tracking.md",
    "langgraph-patterns.md",
    "ml-data-handling.md",
    "predictive-analytics.md",
    "python-project-standards.md",
    "rag-vector-db.md",
    "skill-rules.json",
    "test-first-patterns.md",
]

# Print in two rows
row1 = "  ".join(f"{CYAN}{s}{RESET}" for s in skill_files[:4])
row2 = "  ".join(f"{CYAN}{s}{RESET}" for s in skill_files[4:])
out(row1 + "\r\n")
out(row2 + "\r\n")
pause(2.0)
nl()

out(PROMPT)
pause(3.0)

# === Write the cast file ===
header = {
    "version": 2,
    "width": WIDTH,
    "height": HEIGHT,
    "timestamp": 1742500800,
    "title": "claude-scaffold demo",
    "env": {"TERM": "xterm-256color", "SHELL": "/bin/bash"}
}

output_path = "docs/demo.cast"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(json.dumps(header) + "\n")
    for event in events:
        f.write(json.dumps(event) + "\n")

print(f"Written {len(events)} events to {output_path}")
print(f"Total duration: {t:.1f}s")
