Output docs/demo.gif
Set Shell bash
Set FontSize 15
Set Width 1200
Set Height 680
Set Theme "GitHub Dark"
Set Padding 20
Set Framerate 24
Set TypingSpeed 65ms
Set WindowBar Colorful
Set BorderRadius 10
Set MarginFill "#0d1117"
Set Margin 40

# NOTE: render on Linux only (VHS requires headless Chrome — hangs on Windows)
# On yc-ctrl: npm install -g claude-scaffold, then:
# mkdir ~/vhs-demo && cp demo.tape ~/vhs-demo/ && cd ~/vhs-demo && vhs demo.tape

# --- hidden setup ---
Hide
Type "cd /tmp && rm -rf cs-demo && mkdir cs-demo && cd cs-demo && git init -q"
Enter
Sleep 300ms
Type "clear"
Enter
Sleep 150ms
Show

# === Scene 1: empty project ===
Sleep 500ms
Type "ls -la"
Enter
Sleep 1.2s

# === Scene 2: one-command deploy ===
Sleep 300ms
Type "claude-scaffold init . --profile ml-engineer --lang en 2>/dev/null"
Enter
Sleep 4.5s

Hide
Type "clear"
Enter
Sleep 100ms
Show

# === Scene 3: 20 skills deployed ===
Type "ls .claude/skills/"
Enter
Sleep 3s

Hide
Type "clear"
Enter
Sleep 100ms
Show

# === Scene 4: skill auto-injection — critical-analysis triggers ===
Sleep 400ms
Type "# Skill auto-injection: which skills match this prompt?"
Enter
Sleep 700ms
Type "echo '{\"prompt\":\"analyze hypothesis and approach\"}' \\"
Enter
Sleep 250ms
Type "  | node .claude/hooks/skill-activation-prompt.js \\"
Enter
Sleep 250ms
Type "  | python3 -c \"import sys,json; d=json.load(sys.stdin); print('\\n'.join(l for l in d.get('system_prompt_addition','').split('\\n') if l.startswith('## Skill')))\""
Enter
Sleep 3.5s

Hide
Type "clear"
Enter
Sleep 100ms
Show

# === Scene 5: keep all projects in sync ===
Sleep 400ms
Type "# Propagate updates to every registered project:"
Enter
Sleep 700ms
Type "claude-scaffold status"
Enter
Sleep 2.5s

Sleep 800ms
