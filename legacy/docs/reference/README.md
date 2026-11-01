# Command reference

One page per `bolt` command, generated from `--help` output by `script/docs-reference.ts`.
Run `bolt` with no command (or a project path) to start the TUI.

| Command                         | Description                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------- |
| [`completion`](./completion.md) | generate shell completion script (pass 'fish' for fish)                           |
| [`acp`](./acp.md)               | start ACP (Agent Client Protocol) server                                          |
| [`mcp`](./mcp.md)               | manage MCP (Model Context Protocol) servers                                       |
| [`attach`](./attach.md)         | attach to a running bolt server                                                   |
| [`run`](./run.md)               | run bolt with a message                                                           |
| [`ask`](./ask.md)               | ask a one-shot question and print only the answer to stdout                       |
| [`arena`](./arena.md)           | race agents on the same task in isolated worktrees and keep the best result       |
| [`init`](./init.md)             | initialize bolt config, agents, and commands for a project                        |
| [`debug`](./debug.md)           | debugging and troubleshooting tools                                               |
| [`config`](./config.md)         | inspect and manage configuration                                                  |
| [`providers`](./providers.md)   | manage AI providers and credentials [aliases: auth]                               |
| [`agent`](./agent.md)           | manage agents                                                                     |
| [`upgrade`](./upgrade.md)       | upgrade bolt to the latest or a specific version [aliases: update]                |
| [`uninstall`](./uninstall.md)   | uninstall bolt and remove all related files                                       |
| [`serve`](./serve.md)           | starts a headless bolt server                                                     |
| [`daemon`](./daemon.md)         | keep a warm bolt server running so one-shot commands skip boot                    |
| [`warm`](./warm.md)             | pre-load project context and prompt cache before you start typing                 |
| [`web`](./web.md)               | start bolt server and open web interface                                          |
| [`models`](./models.md)         | list all available models                                                         |
| [`stats`](./stats.md)           | show token usage and cost statistics                                              |
| [`eval`](./eval.md)             | run agent evaluation cases and grade the results                                  |
| [`logs`](./logs.md)             | print the agent log                                                               |
| [`map`](./map.md)               | draw a markdown + mermaid map of source directory dependencies                    |
| [`arch`](./arch.md)             | detect imports that violate the declared module contract                          |
| [`migrate`](./migrate.md)       | generate a major-version upgrade playbook for a dependency                        |
| [`deps`](./deps.md)             | report outdated, vulnerable, deprecated, and abandoned dependencies               |
| [`diff-gate`](./diff-gate.md)   | review a diff from stdin and exit 1 when defects reach a severity threshold       |
| [`owners`](./owners.md)         | map directory ownership from git history and CODEOWNERS                           |
| [`hotspots`](./hotspots.md)     | flag files with high churn and high complexity for refactoring                    |
| [`packages`](./packages.md)     | map the monorepo package graph and its build order                                |
| [`api`](./api.md)               | diff the exported API surface against a git ref                                   |
| [`index`](./index.md)           | build an incrementally updated whole-repo vector index and query it               |
| [`dead`](./dead.md)             | find unused exports ranked by deletion safety                                     |
| [`dupes`](./dupes.md)           | find near-identical code blocks across the repo                                   |
| [`exec`](./exec.md)             | run a markdown playbook of steps non-interactively, stopping on the first failure |
| [`export`](./export.md)         | export session data as JSON, markdown, JSONL, or an HTML replay                   |
| [`import`](./import.md)         | import session data from JSON file or URL                                         |
| [`github`](./github.md)         | manage GitHub agent                                                               |
| [`pr`](./pr.md)                 | fetch and checkout a GitHub PR branch, then run bolt                              |
| [`push`](./push.md)             | push a session to a bolt server on another machine                                |
| [`pull`](./pull.md)             | pull a session from a bolt server on another machine                              |
| [`stack`](./stack.md)           | split the current branch into an ordered stack of reviewable branches             |
| [`commit`](./commit.md)         | commit staged changes with a generated message                                    |
| [`commitlint`](./commitlint.md) | lint commit messages against this repo's own conventions                          |
| [`port`](./port.md)             | port a fix onto other branches with cherry-pick                                   |
| [`split`](./split.md)           | split a messy worktree into logical commits with the agent                        |
| [`review`](./review.md)         | review code changes with the code-review agent                                    |
| [`blast`](./blast.md)           | estimate the blast radius of pending changes                                      |
| [`undo`](./undo.md)             | roll back the last agent turn (files and conversation)                            |
| [`analyze`](./analyze.md)       | run lint, typecheck, and dead-code checks over the current diff before handoff    |
| [`checkpoint`](./checkpoint.md) | save and rewind named checkpoints                                                 |
| [`rebase`](./rebase.md)         | plan an interactive rebase with the agent and explain every decision              |
| [`invariants`](./invariants.md) | state invariants before a refactor and verify them after                          |
| [`resolve`](./resolve.md)       | resolve merge conflicts by intent with the agent                                  |
| [`codemod`](./codemod.md)       | generate an ast-grep transform, preview the diff, and apply it with --apply       |
| [`asserts`](./asserts.md)       | find tests with missing or weak assertions and suggest better ones                |
| [`pipeline`](./pipeline.md)     | run a plan, code, review agent pipeline on a task                                 |
| [`refactor`](./refactor.md)     | refactor with a test-verified loop: change, run, verify, repeat until green       |
| [`tighten`](./tighten.md)       | find loose types in changed code and propose stricter ones                        |
| [`learn`](./learn.md)           | learn this repository's conventions into project memory                           |
| [`drift`](./drift.md)           | flag READMEs and comments that the current diff just made stale                   |
| [`memory`](./memory.md)         | inspect project memory                                                            |
| [`watch`](./watch.md)           | rerun a command on every file change, optionally fixing failures with the agent   |
| [`jobs`](./jobs.md)             | manage background jobs started with run --background                              |
| [`cron`](./cron.md)             | schedule recurring agent chores (dependency bumps, triage, drafts)                |
| [`flaky`](./flaky.md)           | detect flaky tests by rerunning a command, and quarantine offenders               |
| [`proptest`](./proptest.md)     | generate property-based tests for the pure functions in a file                    |
| [`guard`](./guard.md)           | generate a failing regression test from a bug description before fixing it        |
| [`mutate`](./mutate.md)         | mutate a file and rerun the tests to prove they catch bugs                        |
| [`mux`](./mux.md)               | run parallel bolt sessions in tmux split panes                                    |
| [`bisect`](./bisect.md)         | find the commit that broke a command, show blame, and propose a fix               |
| [`batch`](./batch.md)           | run a queue of prompts sequentially or in parallel with a summary table           |
| [`why`](./why.md)               | answer when and why a behavior changed, with commit evidence                      |
| [`bench`](./bench.md)           | benchmark a command on this change and on the base ref, and flag regressions      |
| [`figma`](./figma.md)           | generate components from a Figma design node                                      |
| [`pair`](./pair.md)             | share a live session between two terminals                                        |
| [`session`](./session.md)       | manage sessions [aliases: sessions]                                               |
| [`resume`](./resume.md)         | resume a session, with a fuzzy picker when no id is given                         |
| [`grep`](./grep.md)             | full-text search across every session transcript on disk                          |
| [`tag`](./tag.md)               | tag a session (alias of session tag)                                              |
| [`fork`](./fork.md)             | fork a session at any message and continue down a different path                  |
| [`submodules`](./submodules.md) | report submodule drift and bring submodules in sync                               |
| [`worktree`](./worktree.md)     | create, list, and clean agent worktrees                                           |
| [`plugin`](./plugin.md)         | install plugin and update config [aliases: plug]                                  |
| [`db`](./db.md)                 | database tools                                                                    |
| [`alias`](./alias.md)           | list aliases, show one, or set one with name="expansion"                          |
