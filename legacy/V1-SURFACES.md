<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:f64223f30c77dc845da32a7480ab2c8a317d3c0ed8df21196223f60eff0f410a -->

# V1 interaction and tool inventory

Reference: pre-sync V1 commit `0cae319f4f7065f0bcd4335a579033dac706b7d0`. This supplements [V1-PARITY.md](V1-PARITY.md), whose command table covers custom Bolt handlers. All rows below require behavior verification; matching names and matching key defaults do not establish parity. Flag lists are file-level inventories, so flags shared by sibling subcommands must be checked against their individual builders.

## Classic CLI declarations

This records the classic `packages/opencode` command surfaces in addition to the newer `packages/cli` handlers. Duplicate declarations in the reference are listed once per source. `$0` means the default action for that source's command group. Parent group routes, inherited root flags, aliases and dynamically registered commands need their own call-site verification.

| V1 declaration | Explicit file flags | Status | Reference source |
| --- | --- | --- | --- |
| `login [url]` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/account.ts` |
| `logout [email]` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/account.ts` |
| `switch` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/account.ts` |
| `orgs` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/account.ts` |
| `open` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/account.ts` |
| `console` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/account.ts` |
| `acp` | `--cwd` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/acp.ts` |
| `create` | `--path`, `--description`, `--mode`, `--permissions`, `--model` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/agent.ts` |
| `list` | `--path`, `--description`, `--mode`, `--permissions`, `--model` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/agent.ts` |
| `agent` | `--path`, `--description`, `--mode`, `--permissions`, `--model` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/agent.ts` |
| `api [ref]` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/api.ts` |
| `attach <url>` | `--dir`, `--continue`, `--session`, `--fork`, `--password`, `--username`, `--mini`, `--replay`, `--no-replay`, `--replay-limit` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/attach.ts` |
| `$0 [query]` | `--format` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/db.ts` |
| `path` | `--format` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/db.ts` |
| `db` | `--format` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/db.ts` |
| `agent <name>` | `--tool`, `--params` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/debug/agent.ts` |
| `search <query>` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/debug/file.ts` |
| `read <path>` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/debug/file.ts` |
| `list <path>` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/debug/file.ts` |
| `file` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/debug/file.ts` |
| `debug` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/debug/index.ts` |
| `wait` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/debug/index.ts` |
| `info` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/debug/index.ts` |
| `paths` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/debug/index.ts` |
| `rg` | `--query`, `--glob`, `--limit` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/debug/ripgrep.ts` |
| `files` | `--query`, `--glob`, `--limit` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/debug/ripgrep.ts` |
| `search <pattern>` | `--query`, `--glob`, `--limit` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/debug/ripgrep.ts` |
| `scrap` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/debug/scrap.ts` |
| `v2` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/debug/v2.ts` |
| `export [sessionID]` | `--sanitize`, `--html`, `--md`, `--jsonl`, `--out`, `--json`, `--porcelain` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/export.ts` |
| `generate` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/generate.ts` |
| `import <file>` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/import.ts` |
| `mcp` | `--url`, `--env`, `--header` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/mcp.ts` |
| `list` | `--url`, `--env`, `--header` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/mcp.ts` |
| `auth [name]` | `--url`, `--env`, `--header` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/mcp.ts` |
| `logout [name]` | `--url`, `--env`, `--header` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/mcp.ts` |
| `add [name]` | `--url`, `--env`, `--header` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/mcp.ts` |
| `debug <name>` | `--url`, `--env`, `--header` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/mcp.ts` |
| `migrate [package] [target]` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/migrate.ts` |
| `models [provider]` | `--verbose`, `--refresh`, `--json`, `--porcelain` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/models.ts` |
| `plugin <module>` | `--global`, `--force` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/plug.ts` |
| `pr <number>` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/pr.ts` |
| `providers` | `--provider`, `--method` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/providers.ts` |
| `list` | `--provider`, `--method` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/providers.ts` |
| `login [url]` | `--provider`, `--method` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/providers.ts` |
| `logout [provider]` | `--provider`, `--method` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/providers.ts` |
| `run [message..]` | `--command`, `--continue`, `--session`, `--fork`, `--share`, `--model`, `--best-of`, `--agent`, `--auto-agent`, `--format`, `--json`, `--porcelain`, `--emit`, `--file`, `--title`, `--max-cost`, `--timeout`, `--retries`, `--max-tokens`, `--output-schema`, `--cost-report`, `--attach`, `--host`, `--voice`, `--password`, `--username`, `--dir`, `--port`, `--variant`, `--thinking`, `--mini`, `--replay`, `--replay-limit`, `--interactive`, `--auto`, `--dry-run`, `--plan-only`, `--background`, `--yolo`, `--dangerously-skip-permissions`, `--demo`, `--pair` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/run.ts` |
| `serve` | `--api` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/serve.ts` |
| `session` | `--remove`, `--days`, `--dry-run`, `--max-count`, `--since`, `--project`, `--failed`, `--sort`, `--json`, `--tag`, `--format` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/session.ts` |
| `tag <sessionID> [tags..]` | `--remove`, `--days`, `--dry-run`, `--max-count`, `--since`, `--project`, `--failed`, `--sort`, `--json`, `--tag`, `--format` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/session.ts` |
| `prune` | `--remove`, `--days`, `--dry-run`, `--max-count`, `--since`, `--project`, `--failed`, `--sort`, `--json`, `--tag`, `--format` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/session.ts` |
| `branch <sessionID> [messageID]` | `--remove`, `--days`, `--dry-run`, `--max-count`, `--since`, `--project`, `--failed`, `--sort`, `--json`, `--tag`, `--format` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/session.ts` |
| `delete <sessionID>` | `--remove`, `--days`, `--dry-run`, `--max-count`, `--since`, `--project`, `--failed`, `--sort`, `--json`, `--tag`, `--format` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/session.ts` |
| `list` | `--remove`, `--days`, `--dry-run`, `--max-count`, `--since`, `--project`, `--failed`, `--sort`, `--json`, `--tag`, `--format` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/session.ts` |
| `stats` | `--days`, `--tools`, `--models`, `--project`, `--json`, `--porcelain` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/stats.ts` |
| `$0 [project]` | `--model`, `--continue`, `--session`, `--fork`, `--prompt`, `--agent`, `--auto`, `--yolo`, `--dangerously-skip-permissions`, `--mini`, `--replay`, `--no-replay`, `--replay-limit`, `--demo` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/tui.ts` |
| `uninstall` | `--keep-config`, `--keep-data`, `--dry-run`, `--force` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/uninstall.ts` |
| `upgrade [target]` | `--method`, `--channel`, `--undo` | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/upgrade.ts` |
| `web` | — | Pending behavior/flags comparison | `packages/opencode/src/cli/cmd/web.ts` |

## TUI slash registrations

Literal registrations from every V1 TUI source are listed below. Aliases and argument parsing remain part of each action audit. Server-provided project/skill commands are dynamic and must also be compared through the command catalog.

| Slash action | Status | V1 source/line |
| --- | --- | --- |
| /agents | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:956` |
| /auto-approve | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:1350` |
| /btw | Registered; behavior/aliases pending | `packages/tui/src/feature-plugins/prompt/btw.tsx:57`; `packages/tui/src/routes/session/index.tsx:1178` |
| /cd | Registered; behavior/aliases pending | `packages/tui/src/component/prompt/index.tsx:272` |
| /compact | Registered; behavior/aliases pending | `packages/tui/src/routes/session/index.tsx:1191` |
| /compact-view | Verified at 44/100 columns; transcript/row/verbosity tests repeated ten times (400 passes); persistence, SSE completion and todo history | `packages/tui/src/routes/session/index.tsx:1287` |
| /connect | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:1047` |
| /copy | Registered; behavior/aliases pending | `packages/tui/src/routes/session/index.tsx:1435` |
| /copy-session | Verified at 44/100 columns; transcript/row/verbosity tests repeated ten times (400 passes); persistence, SSE completion and todo history | `packages/tui/src/routes/session/index.tsx:1478` |
| /cost-alert | Registered; behavior/aliases pending | `packages/tui/src/component/prompt/index.tsx:577` |
| /debug | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:1137` |
| /diff | Registered; behavior/aliases pending | `packages/tui/src/feature-plugins/system/diff-viewer.tsx:1312` |
| /editor | Registered; behavior/aliases pending | `packages/tui/src/component/prompt/index.tsx:588` |
| /exit | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:1194` |
| /export | Registered; behavior/aliases pending | `packages/tui/src/routes/session/index.tsx:1504` |
| /fork | Registered; behavior/aliases pending | `packages/tui/src/routes/session/index.tsx:1161` |
| /help | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:1177` |
| /highlights | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:1062` |
| /mcps | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:995` |
| /memory | Registered; behavior/aliases pending | `packages/tui/src/feature-plugins/system/memory.tsx:16` |
| /models | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:911` |
| /new | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:732` |
| /open | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:835` |
| /pair | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:1091` |
| /plan | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:965` |
| /plugins | Registered; behavior/aliases pending | `packages/tui/src/feature-plugins/system/plugins.tsx:334` |
| /process | Registered; behavior/aliases pending | `packages/tui/src/feature-plugins/system/process.tsx:251` |
| /redo | Registered; behavior/aliases pending | `packages/tui/src/routes/session/index.tsx:1248` |
| /reload | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:1121`; `packages/tui/src/feature-plugins/system/reload.tsx:16` |
| /rename | Registered; behavior/aliases pending | `packages/tui/src/routes/session/index.tsx:1119` |
| /restart | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:1102` |
| /sandbox | Registered; behavior/aliases pending | `packages/tui/src/feature-plugins/system/sandbox.tsx:50` |
| /sessions | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:722` |
| /sidebar | Registered; behavior/aliases pending | `packages/tui/src/routes/home.tsx:75`; `packages/tui/src/routes/session/index.tsx:1271` |
| /skills | Registered; behavior/aliases pending | `packages/tui/src/component/prompt/index.tsx:628` |
| /stats | Registered; behavior/aliases pending | `packages/tui/src/feature-plugins/system/stats.tsx:200` |
| /status | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:1071` |
| /terminal | Registered; behavior/aliases pending | `packages/tui/src/component/session-frame.tsx:250` |
| /themes | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:1146` |
| /timeline | Registered; behavior/aliases pending | `packages/tui/src/routes/session/index.tsx:1146` |
| /timestamps | Verified at 44/100 columns; transcript/row/verbosity tests repeated ten times (400 passes); persistence, SSE completion and todo history | `packages/tui/src/routes/session/index.tsx:1313` |
| /todos | Verified at 44/100 columns; transcript/row/verbosity tests repeated ten times (400 passes); persistence, SSE completion and todo history | `packages/tui/src/routes/session/index.tsx:1134` |
| /undo | Registered; behavior/aliases pending | `packages/tui/src/routes/session/index.tsx:1215` |
| /update | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:1082` |
| /usage | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:986` |
| /variants | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:1022` |
| /vim | Registered; behavior/aliases pending | `packages/tui/src/component/prompt/vim-mode.tsx:217` |
| /voice | Registered; behavior/aliases pending | `packages/tui/src/app.tsx:758` |
| /warp | Existing /worktrees alias in prompt/index.tsx; exact action audit pending | `packages/tui/src/component/prompt/index.tsx:669` |
| /workspaces | Existing /worktrees alias in prompt/index.tsx; exact action audit pending | `packages/tui/src/app.tsx:808` |
| /worktrees | Registered; behavior/aliases pending | `packages/tui/src/component/prompt/index.tsx:679` |

## Keybinding defaults

These are the literal string defaults in V1's keybinding definitions. Non-literal definitions (including leader, platform-dependent objects, multi-line expressions and migrated legacy binding names) require the remaining schema/migration audit. Matching defaults still need an action test.

| Action | V1 default | V2 comparison |
| --- | --- | --- |
| `app.exit` | `ctrl+c,ctrl+d,<leader>q` | Same default; action pending |
| `app.clear` | `ctrl+l` | Same default; action pending |
| `app.debug` | `none` | Same default; action pending |
| `app.console` | `none` | Same default; action pending |
| `app.scrap` | `none` | Same default; action pending |
| `app.toggle.animations` | `none` | Same default; action pending |
| `app.toggle.file_context` | `none` | Same default; action pending |
| `app.toggle.diffwrap` | `none` | Same default; action pending |
| `app.toggle.paste_summary` | `none` | Same default; action pending |
| `command.palette.show` | `ctrl+p` | Same default; action pending |
| `help.show` | `none` | Same default; action pending |
| `docs.open` | `none` | Same default; action pending |
| `opencode.settings` | `none` | Same default; action pending |
| `server.pair` | `none` | Same default; action pending |
| `service.restart` | `none` | Same default; action pending |
| `location.reload` | `none` | Same default; action pending |
| `diff.open` | `none` | Same default; action pending |
| `diff.close` | `escape,q` | Same default; action pending |
| `diff.down` | `j,down` | Same default; action pending |
| `diff.up` | `k,up` | Same default; action pending |
| `diff.page.down` | `pagedown,ctrl+f` | Same default; action pending |
| `diff.page.up` | `pageup,ctrl+b` | Same default; action pending |
| `diff.half_page.down` | `ctrl+d` | Same default; action pending |
| `diff.half_page.up` | `ctrl+u` | Same default; action pending |
| `diff.first` | `gg,home` | Same default; action pending |
| `diff.last` | `shift+g,end` | Same default; action pending |
| `diff.toggle` | `none` | Same default; action pending |
| `diff.expand` | `none` | Same default; action pending |
| `diff.expand_all` | `none` | Same default; action pending |
| `diff.collapse` | `none` | Same default; action pending |
| `diff.switch_focus` | `none` | Same default; action pending |
| `diff.next_hunk` | `]` | Same default; action pending |
| `diff.previous_hunk` | `[` | Same default; action pending |
| `diff.next_file` | `n,alt+down` | Same default; action pending |
| `diff.previous_file` | `p,alt+up` | Same default; action pending |
| `diff.toggle_file_tree` | `b` | Same default; action pending |
| `diff.single_patch` | `s` | Same default; action pending |
| `diff.switch_source` | `d` | Same default; action pending |
| `diff.toggle_view` | `v` | Same default; action pending |
| `diff.toggle_fullscreen` | `f` | Same default; action pending |
| `diff.mark_reviewed` | `m` | Same default; action pending |
| `diff.help` | `?,shift+?,shift+/` | Same default; action pending |
| `prompt.editor` | `<leader>e` | Same default; action pending |
| `theme.switch` | `none` | Same default; action pending |
| `theme.switch_mode` | `none` | Same default; action pending |
| `theme.mode.lock` | `none` | Same default; action pending |
| `session.sidebar.toggle` | `<leader>b` | Same default; action pending |
| `pane.focus.left` | `<leader>left` | Same default; action pending |
| `pane.focus.right` | `<leader>right` | Same default; action pending |
| `terminal.select` | `<leader>down` | Same default; action pending |
| `terminal.toggle` | `<leader>t` | Same default; action pending |
| `terminal.close` | `<leader>up` | Same default; action pending |
| `session.toggle.scrollbar` | `none` | Same default; action pending |
| `opencode.status` | `<leader>s` | Same default; action pending |
| `opencode.debug` | `none` | Same default; action pending |
| `stash.delete` | `ctrl+d` | Same default; action pending |
| `model.dialog.provider` | `ctrl+a` | Same default; action pending |
| `model.dialog.favorite` | `ctrl+f` | Same default; action pending |
| `model.dialog.usage` | `ctrl+u` | Same default; action pending |
| `model.list` | `<leader>m` | Same default; action pending |
| `model.cycle_recent` | `f2` | Same default; action pending |
| `model.cycle_recent_reverse` | `shift+f2` | Same default; action pending |
| `model.cycle_favorite` | `none` | Same default; action pending |
| `model.cycle_favorite_reverse` | `none` | Same default; action pending |
| `mcp.list` | `none` | Same default; action pending |
| `usage.show` | `none` | Same default; action pending |
| `provider.connect` | `none` | Same default; action pending |
| `agent.list` | `<leader>a` | Same default; action pending |
| `agent.cycle` | `shift+tab` | Same default; action pending |
| `agent.cycle.reverse` | `none` | Same default; action pending |
| `variant.cycle` | `ctrl+t` | Same default; action pending |
| `variant.list` | `none` | Same default; action pending |
| `session.page.up` | `pageup,ctrl+alt+b` | Same default; action pending |
| `session.page.down` | `pagedown,ctrl+alt+f` | Same default; action pending |
| `session.line.up` | `ctrl+alt+y` | Same default; action pending |
| `session.line.down` | `ctrl+alt+e` | Same default; action pending |
| `session.half.page.up` | `ctrl+alt+u` | Same default; action pending |
| `session.half.page.down` | `ctrl+alt+d` | Same default; action pending |
| `session.first` | `ctrl+g,home,alt+home` | Same default; action pending |
| `session.last` | `ctrl+alt+g,end` | Same default; action pending |
| `session.message.next` | `none` | Same default; action pending |
| `session.message.previous` | `none` | Same default; action pending |
| `session.message.user.next` | `none` | Same default; action pending |
| `session.message.user.previous` | `none` | Same default; action pending |
| `session.messages_last_user` | `alt+end` | Same default; action pending |
| `messages.copy` | `<leader>y` | Same default; action pending |
| `session.undo` | `<leader>u` | Same default; action pending |
| `session.redo` | `<leader>r` | Same default; action pending |
| `session.toggle.thinking` | `none` | Same default; action pending |
| `prompt.clear` | `ctrl+c` | Same default; action pending |
| `input.submit` | `return` | Same default; action pending |
| `input.newline` | `shift+return,ctrl+return,alt+return,ctrl+j` | Same default; action pending |
| `input.move.left` | `left,ctrl+b` | Same default; action pending |
| `input.move.right` | `right,ctrl+f` | Same default; action pending |
| `input.move.up` | `up` | Same default; action pending |
| `input.move.down` | `down` | Same default; action pending |
| `input.select.left` | `shift+left` | Same default; action pending |
| `input.select.right` | `shift+right` | Same default; action pending |
| `input.select.up` | `shift+up` | Same default; action pending |
| `input.select.down` | `shift+down` | Same default; action pending |
| `input.line.home` | `ctrl+a` | Same default; action pending |
| `input.line.end` | `ctrl+e` | Same default; action pending |
| `input.select.line.home` | `ctrl+shift+a` | Same default; action pending |
| `input.select.line.end` | `ctrl+shift+e` | Same default; action pending |
| `input.visual.line.home` | `alt+a` | Same default; action pending |
| `input.visual.line.end` | `alt+e` | Same default; action pending |
| `input.select.visual.line.home` | `alt+shift+a` | Same default; action pending |
| `input.select.visual.line.end` | `alt+shift+e` | Same default; action pending |
| `input.buffer.home` | `none` | Same default; action pending |
| `input.buffer.end` | `none` | Same default; action pending |
| `input.select.buffer.home` | `shift+home` | Same default; action pending |
| `input.select.buffer.end` | `shift+end` | Same default; action pending |
| `input.delete.line` | `ctrl+shift+d` | Same default; action pending |
| `input.delete.to.line.end` | `ctrl+k` | Same default; action pending |
| `input.delete.to.line.start` | `ctrl+u` | Same default; action pending |
| `input.backspace` | `backspace,shift+backspace` | Same default; action pending |
| `input.delete` | `ctrl+d,delete,shift+delete` | Same default; action pending |
| `input.undo` | `ctrl+-,super+z` | Same default; action pending |
| `input.redo` | `ctrl+.,super+shift+z` | Same default; action pending |
| `input.word.forward` | `alt+f,alt+right,ctrl+right` | Same default; action pending |
| `input.word.backward` | `alt+b,alt+left,ctrl+left` | Same default; action pending |
| `input.select.word.forward` | `alt+shift+f,alt+shift+right` | Same default; action pending |
| `input.select.word.backward` | `alt+shift+b,alt+shift+left` | Same default; action pending |
| `input.delete.word.forward` | `alt+d,alt+delete,ctrl+delete` | Same default; action pending |
| `input.delete.word.backward` | `ctrl+w,ctrl+backspace,alt+backspace` | Same default; action pending |
| `input.select.all` | `super+a` | Same default; action pending |
| `prompt.history.previous` | `up` | Same default; action pending |
| `prompt.history.next` | `down` | Same default; action pending |
| `composer.subagent.up` | `up` | Same default; action pending |
| `composer.subagent.down` | `down` | Same default; action pending |
| `composer.subagent.select` | `return` | Same default; action pending |
| `composer.subagent.interrupt` | `ctrl+d` | Same default; action pending |
| `composer.shell.up` | `up` | Same default; action pending |
| `composer.shell.down` | `down` | Same default; action pending |
| `composer.shell.select` | `return` | Same default; action pending |
| `composer.shell.kill` | `ctrl+d` | Same default; action pending |
| `composer.terminal.up` | `up,k` | Same default; action pending |
| `composer.terminal.down` | `down,j` | Same default; action pending |
| `composer.terminal.select` | `return` | Same default; action pending |
| `dialog.select.prev` | `up,ctrl+p` | Same default; action pending |
| `dialog.select.next` | `down,ctrl+n` | Same default; action pending |
| `dialog.select.page_up` | `pageup` | Same default; action pending |
| `dialog.select.page_down` | `pagedown` | Same default; action pending |
| `dialog.select.home` | `home` | Same default; action pending |
| `dialog.select.end` | `end` | Same default; action pending |
| `dialog.select.submit` | `return` | Same default; action pending |
| `dialog.prompt.submit` | `return` | Same default; action pending |
| `dialog.integration.rename` | `ctrl+r` | Same default; action pending |
| `dialog.integration.delete` | `ctrl+d` | Same default; action pending |
| `dialog.worktree.generate` | `tab` | Same default; action pending |
| `dialog.move_session.new` | `ctrl+a` | Same default; action pending |
| `dialog.move_session.move` | `ctrl+m` | Same default; action pending |
| `dialog.move_session.delete` | `ctrl+d` | Same default; action pending |
| `dialog.move_session.refresh` | `ctrl+r` | Same default; action pending |
| `prompt.autocomplete.prev` | `up,ctrl+p` | Same default; action pending |
| `prompt.autocomplete.next` | `down,ctrl+n` | Same default; action pending |
| `prompt.autocomplete.hide` | `escape` | Same default; action pending |
| `prompt.autocomplete.select` | `return` | Same default; action pending |
| `prompt.autocomplete.complete` | `tab` | Same default; action pending |
| `permission.prompt.fullscreen` | `ctrl+f` | Same default; action pending |
| `plugins.toggle` | `return` | Same default; action pending |
| `dialog.mcp.toggle` | `space` | Same default; action pending |
| `dialog.plugins.error` | `space` | Same default; action pending |
| `dialog.plugins.update` | `ctrl+u` | Same default; action pending |
| `dialog.plugins.check` | `ctrl+r` | Same default; action pending |
| `terminal.suspend` | `ctrl+z` | Same default; action pending |
| `terminal.title.toggle` | `none` | Same default; action pending |
| `plugins.list` | `none` | Same default; action pending |
| `which-key.toggle` | `ctrl+alt+k` | Same default; action pending |
| `which-key.layout.toggle` | `ctrl+alt+shift+k` | Same default; action pending |
| `which-key.pending.toggle` | `ctrl+alt+shift+p` | Same default; action pending |
| `which-key.group.previous` | `ctrl+alt+left,ctrl+alt+[` | Same default; action pending |
| `which-key.group.next` | `ctrl+alt+right,ctrl+alt+]` | Same default; action pending |
| `which-key.scroll.up` | `ctrl+alt+up,ctrl+alt+p` | Same default; action pending |
| `which-key.scroll.down` | `ctrl+alt+down,ctrl+alt+n` | Same default; action pending |
| `which-key.page.up` | `ctrl+alt+pageup` | Same default; action pending |
| `which-key.page.down` | `ctrl+alt+pagedown` | Same default; action pending |
| `which-key.home` | `ctrl+alt+home` | Same default; action pending |
| `which-key.end` | `ctrl+alt+end` | Same default; action pending |

## Classic tool definitions

Literal tool definitions are listed once by tool name, with all declaration sources retained. Registration guards, experimental settings and indirect/generated definitions require separate checks. Refer to the main parity checklist for the tested notebook/task/checkpoint implementations and outstanding services.

| Tool | Status | Reference source |
| --- | --- | --- |
| `apply_patch` | Pending complete input/output/permission/error comparison | `packages/opencode/src/tool/apply_patch.ts` |
| `edit` | Pending complete input/output/permission/error comparison | `packages/opencode/src/tool/edit.ts` |
| `glob` | Pending complete input/output/permission/error comparison | `packages/opencode/src/tool/glob.ts` |
| `grep` | Pending complete input/output/permission/error comparison | `packages/opencode/src/tool/grep.ts` |
| `lsp` | Pending complete input/output/permission/error comparison | `packages/opencode/src/tool/lsp.ts` |
| `plan_exit` | Pending complete input/output/permission/error comparison | `packages/opencode/src/tool/plan.ts` |
| `skill` | Pending complete input/output/permission/error comparison | `packages/opencode/src/tool/skill.ts` |
| `webfetch` | Pending complete input/output/permission/error comparison | `packages/opencode/src/tool/webfetch.ts` |
| `websearch` | Pending complete input/output/permission/error comparison | `packages/opencode/src/tool/websearch.ts` |
| `write` | Pending complete input/output/permission/error comparison | `packages/opencode/src/tool/write.ts` |

## Mini capabilities requiring end-to-end comparison

- Best-of-N parsing, independently isolated attempts, judging, failure fallback and cleanup.
- Arena execution, anonymous candidate labels, worktree retention and winner selection.
- Cost/token/time budgets, retry and interrupt exit codes, saved cost reports.
- JSON, porcelain and emit-context output; output-schema loading and final-answer validation.
- Dry-run, plan-only and pair workflows and their permissions/approval boundaries.
- Local and attached interactive sessions; replay after resize/resume, replay limits and cancellation.
- Prompt editing, Vim, attachments, voice, specialist agents, model variants, commands and permissions/forms.
- Original Bolt splash, title/gradient/theme, streaming output, tool details and turn summaries.

These are open gates. Presence of V2 Mini or a standalone tournament command does not complete these rows.


<!-- /coderabbit-ai-generated:v1 -->