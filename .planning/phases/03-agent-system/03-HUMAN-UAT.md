---
status: partial
phase: 03-agent-system
source: [03-VERIFICATION.md]
started: 2026-03-28T00:00:00Z
updated: 2026-03-28T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Chat sidebar visual flow — full thinking → tool call → streaming text → done UX
expected: Open canvas page, click toggle button, sidebar slides in. Type message, see thinking dots → tool call block → streaming assistant text → done. Smooth 200ms animation.
result: [pending]

### 2. Abort mid-stream — stops streaming, saves partial messages
expected: During streaming, click abort button (red square). Streaming stops, partial messages saved to session. Re-opening session shows partial history.
result: [pending]

### 3. Responsive sidebar — desktop side-panel / tablet overlay / mobile full-screen
expected: Desktop (≥1024px): sidebar pushes canvas left with mr-380px. Tablet (768-1023px): overlay with backdrop. Mobile (<768px): full-screen overlay.
result: [pending]

### 4. Session list management — create, switch, history loading
expected: Click session list toggle in header. See "新对话" button + session history. Create new session, switch between sessions, messages load correctly.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
