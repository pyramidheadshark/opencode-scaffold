Output docs/demo.gif

Set Shell "bash"
Set FontSize 13
Set Width 1200
Set Height 620
Set Theme "Dracula"
Set Padding 20
Set Framerate 24
Set TypingSpeed 75ms

# --- hidden setup ---
Hide
Type "cd /tmp && rm -rf cs-demo && mkdir cs-demo && cd cs-demo && git init -q"
Enter
Sleep 300ms
Show

# === Scene 1: empty project ===
Sleep 600ms
Type "ls -la"
Enter
Sleep 1.2s

# === Scene 2: one command ===
Sleep 400ms
Type "claude-scaffold init . --profile ml-engineer --lang en 2>/dev/null"
Enter
Sleep 3.5s

# === Scene 3: show what was deployed ===
Hide
Type "clear"
Enter
Sleep 100ms
Show

Type "ls .claude/"
Enter
Sleep 1s

Type "ls .claude/skills/"
Enter
Sleep 2.5s
