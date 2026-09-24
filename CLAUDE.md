@AGENTS.md

# Claude Code

Shared project rules live in `AGENTS.md` (imported above). Put project rules there, not here.

- **Another coding agent, OpenAI Codex, may modify this repository between Claude sessions.** Inspect the current
  repo, `git status` and the Git diff/log before working. Don't assume a previous Claude session is still current.
- Use `docs/CURRENT_STATE.md` for the current development handoff.
- Use `docs/ARCHITECTURE.md` when changing system boundaries.
- Use `docs/DECISIONS.md` when evaluating established decisions.
- Use `docs/PHASE_1.md` when determining milestone scope.
- Read only the documents relevant to the current task.

## Claude-specific tooling notes
- `.claude/launch.json` defines the browser-preview servers: `im-dog-dev` (port 5173) and `im-dog-preview` (port 4173, serves `dist/`).
- The desktop app's built-in browser pane may not grant pointer lock (you'll see the drag-to-look fallback), and
  it pauses `requestAnimationFrame` while hidden. Treat pointer-lock and FPS results from it as unconfirmed.
