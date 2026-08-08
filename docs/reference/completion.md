# bolt completion

generate shell completion script (pass 'fish' for fish)

```
Unknown argument: completion
 /$$$$$$$   /$$$$$$  /$$    /$$$$$$$$       /$$$$$$  /$$       /$$$$$$
| $$__  $$ /$$__  $$| $$   |__  $$__/      /$$__  $$| $$      |_  $$_/
| $$  \ $$| $$  \ $$| $$    | | $$        | $$  \__/| $$        | $$
| $$$$$$$ | $$  | $$| $$      | $$        | $$      | $$        | $$
| $$__  $$| $$  | $$| $$      | $$        | $$      | $$        | $$
| $$  \ $$| $$  | $$| $$      | $$        | $$    $$| $$        | $$
| $$$$$$$/|  $$$$$$/| $$$$$$$$| $$        |  $$$$$$/| $$$$$$$$ /$$$$$$
|_______/  \______/ |________/|__/         \______/ |________/|______/

Commands:
  bolt completion                     generate shell completion script (pass 'fish' for fish)
  bolt acp                            start ACP (Agent Client Protocol) server
  bolt mcp                            manage MCP (Model Context Protocol) servers
  bolt [project]                      start bolt tui                                       [default]
  bolt attach <url>                   attach to a running bolt server
  bolt run [message..]                run bolt with a message
  bolt ask <question..>               ask a one-shot question and print only the answer to stdout
  bolt arena [message..]              race agents on the same task in isolated worktrees and keep
                                      the best result
  bolt init [directory]               initialize bolt config, agents, and commands for a project
  bolt debug                          debugging and troubleshooting tools
  bolt config                         inspect and manage configuration
  bolt providers                      manage AI providers and credentials            [aliases: auth]
  bolt agent                          manage agents
  bolt upgrade [target]               upgrade bolt to the latest or a specific version
                                                                                   [aliases: update]
  bolt uninstall                      uninstall bolt and remove all related files
  bolt serve                          starts a headless bolt server
  bolt daemon                         keep a warm bolt server running so one-shot commands skip boot
  bolt warm                           pre-load project context and prompt cache before you start
                                      typing
  bolt web                            start bolt server and open web interface
  bolt models [provider]              list all available models
  bolt stats                          show token usage and cost statistics
  bolt eval [paths..]                 run agent evaluation cases and grade the results
  bolt logs                           print the agent log
  bolt map                            draw a markdown + mermaid map of source directory dependencies
  bolt arch                           detect imports that violate the declared module contract
  bolt migrate [package] [target]     generate a major-version upgrade playbook for a dependency
  bolt deps                           report outdated, vulnerable, deprecated, and abandoned
                                      dependencies
  bolt diff-gate                      review a diff from stdin and exit 1 when defects reach a
                                      severity threshold
  bolt owners                         map directory ownership from git history and CODEOWNERS
  bolt hotspots                       flag files with high churn and high complexity for refactoring
  bolt packages                       map the monorepo package graph and its build order
  bolt api [ref]                      diff the exported API surface against a git ref
  bolt index [query]                  build an incrementally updated whole-repo vector index and
                                      query it
  bolt dead                           find unused exports ranked by deletion safety
  bolt dupes                          find near-identical code blocks across the repo
  bolt exec                           run a markdown playbook of steps non-interactively, stopping
                                      on the first failure
  bolt export [sessionID]             export session data as JSON, markdown, JSONL, or an HTML
                                      replay
  bolt import <file>                  import session data from JSON file or URL
  bolt github                         manage GitHub agent
  bolt pr <number>                    fetch and checkout a GitHub PR branch, then run bolt
  bolt push <sessionID> <url>         push a session to a bolt server on another machine
  bolt pull <sessionID> <url>         pull a session from a bolt server on another machine
  bolt stack                          split the current branch into an ordered stack of reviewable
                                      branches
  bolt commit                         commit staged changes with a generated message
  bolt commitlint                     lint commit messages against this repo's own conventions
  bolt port <commit>                  port a fix onto other branches with cherry-pick
  bolt split                          split a messy worktree into logical commits with the agent
  bolt review                         review code changes with the code-review agent
  bolt blast                          estimate the blast radius of pending changes
  bolt undo                           roll back the last agent turn (files and conversation)
  bolt analyze                        run lint, typecheck, and dead-code checks over the current
                                      diff before handoff
  bolt checkpoint                     save and rewind named checkpoints
  bolt rebase                         plan an interactive rebase with the agent and explain every
                                      decision
  bolt invariants <action> [files..]  state invariants before a refactor and verify them after
  bolt resolve [file..]               resolve merge conflicts by intent with the agent
  bolt codemod [description]          generate an ast-grep transform, preview the diff, and apply it
                                      with --apply
  bolt asserts [files..]              find tests with missing or weak assertions and suggest better
                                      ones
  bolt pipeline <task>                run a plan, code, review agent pipeline on a task
  bolt refactor <instruction>         refactor with a test-verified loop: change, run, verify,
                                      repeat until green
  bolt tighten [files..]              find loose types in changed code and propose stricter ones
  bolt learn                          learn this repository's conventions into project memory
  bolt drift                          flag READMEs and comments that the current diff just made
                                      stale
  bolt memory                         inspect project memory
  bolt watch <command>                rerun a command on every file change, optionally fixing
                                      failures with the agent
  bolt jobs <action> [id]             manage background jobs started with run --background
  bolt cron <action> [args..]         schedule recurring agent chores (dependency bumps, triage,
                                      drafts)
  bolt flaky <command>                detect flaky tests by rerunning a command, and quarantine
                                      offenders
  bolt proptest <file>                generate property-based tests for the pure functions in a file
  bolt guard <bug>                    generate a failing regression test from a bug description
                                      before fixing it
  bolt mutate <file>                  mutate a file and rerun the tests to prove they catch bugs
  bolt mux [dirs..]                   run parallel bolt sessions in tmux split panes
  bolt bisect <command>               find the commit that broke a command, show blame, and propose
                                      a fix
  bolt batch <file>                   run a queue of prompts sequentially or in parallel with a
                                      summary table
  bolt why <question>                 answer when and why a behavior changed, with commit evidence
  bolt bench <command>                benchmark a command on this change and on the base ref, and
                                      flag regressions
  bolt figma <url>                    generate components from a Figma design node
  bolt pair                           share a live session between two terminals
  bolt session                        manage sessions                            [aliases: sessions]
  bolt resume [sessionID]             resume a session, with a fuzzy picker when no id is given
  bolt grep <pattern>                 full-text search across every session transcript on disk
  bolt tag <sessionID> [tags..]       tag a session (alias of session tag)
  bolt fork <sessionID> [messageID]   fork a session at any message and continue down a different
                                      path
  bolt submodules                     report submodule drift and bring submodules in sync
  bolt worktree                       create, list, and clean agent worktrees
  bolt plugin <module>                install plugin and update config               [aliases: plug]
  bolt db                             database tools
  bolt alias [entry]                  list aliases, show one, or set one with name="expansion"

Positionals:
  project  path to start bolt in                                                            [string]

Options:
  -h, --help          show help                                                            [boolean]
  -v, --version       show version number                                                  [boolean]
      --print-logs    print logs to stderr                                                 [boolean]
      --log-level     log level                 [string] [choices: "DEBUG", "INFO", "WARN", "ERROR"]
      --pure          run without external plugins                                         [boolean]
      --profile       use a named config profile                                            [string]
      --quiet         suppress non-essential output on stderr (errors still print)         [boolean]
      --verbose       print debug logs to stderr (implies --print-logs and --log-level DEBUG)
                                                                                           [boolean]
      --offline       fail fast on network access instead of hanging                       [boolean]
      --port          port to listen on                                        [number] [default: 0]
      --hostname      hostname to listen on                          [string] [default: "127.0.0.1"]
      --mdns          enable mDNS service discovery (defaults hostname to 0.0.0.0)
                                                                          [boolean] [default: false]
      --mdns-domain   custom domain name for mDNS service (default: opencode.local)
                                                                [string] [default: "opencode.local"]
      --cors          additional domains to allow for CORS                     [array] [default: []]
  -m, --model         model to use in the format of provider/model                          [string]
  -c, --continue      continue the last session                                            [boolean]
  -s, --session       session id to continue                                                [string]
      --fork          fork the session when continuing (use with --continue or --session)  [boolean]
      --prompt        prompt to use                                                         [string]
      --agent         agent to use                                                          [string]
      --auto          auto-approve permissions that are not explicitly denied (dangerous!)
                                                                          [boolean] [default: false]
      --mini          start the minimal interactive interface             [boolean] [default: false]
      --no-replay     disable mini session history replay on resume and after resize       [boolean]
      --replay-limit  cap visible mini replay to the newest N messages                      [number]
```
