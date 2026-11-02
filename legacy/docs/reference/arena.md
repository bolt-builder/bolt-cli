# bolt arena [message..]

race agents on the same task in isolated worktrees and keep the best result

```
bolt arena [message..]

race agents on the same task in isolated worktrees and keep the best result

Positionals:
  message  task to send to every contender                                     [array] [default: []]

Options:
  -h, --help        show help                                                              [boolean]
  -v, --version     show version number                                                    [boolean]
      --print-logs  print logs to stderr                                                   [boolean]
      --log-level   log level                   [string] [choices: "DEBUG", "INFO", "WARN", "ERROR"]
      --pure        run without external plugins                                           [boolean]
      --profile     use a named config profile                                              [string]
      --quiet       suppress non-essential output on stderr (errors still print)           [boolean]
      --verbose     print debug logs to stderr (implies --print-logs and --log-level DEBUG)[boolean]
      --offline     fail fast on network access instead of hanging                         [boolean]
      --models      comma-separated provider/model list (duplicates allowed, one worktree each)
                                                                                 [string] [required]
      --judge       judge model as provider/model (defaults to the first entry in --models) [string]
      --agent       agent to use for every contender                                        [string]
      --variant     model variant (provider-specific reasoning effort, e.g., high, max, minimal)
                                                                                            [string]
      --format      format: default (formatted) or json (single JSON result)
                                          [string] [choices: "default", "json"] [default: "default"]
      --cleanup     remove losing worktrees and their branches after judging
                                                                          [boolean] [default: false]
```
