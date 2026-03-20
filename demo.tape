Output docs/demo.gif
Set Shell bash
Set FontSize 17
Set Width 1200
Set Height 700
Set Theme "Catppuccin Mocha"
Set Padding 24
Set Framerate 24
Set TypingSpeed 70ms
Set WindowBar Colorful
Set BorderRadius 12
Set MarginFill "#1e1e2e"
Set Margin 50

# NOTE: render on Linux only (VHS requires headless Chrome — hangs on Windows)
# ssh yc-ctrl, install vhs + ttyd 1.7.7 + chromium + claude-scaffold, then:
# cd ~/vhs-demo && vhs demo.tape

Hide
Type "cd /tmp && rm -rf cs-demo && mkdir cs-demo && cd cs-demo && git init -q"
Enter
Sleep 400ms
Type "clear"
Enter
Sleep 200ms
Show

Sleep 500ms
Type "ls -la"
Enter
Sleep 1.2s

Sleep 300ms
Type "claude-scaffold init . --profile ml-engineer --lang en 2>/dev/null"
Enter
Sleep 4s

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
