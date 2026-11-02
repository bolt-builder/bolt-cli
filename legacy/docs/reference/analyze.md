# bolt analyze

run lint, typecheck, and dead-code checks over the current diff before handoff

```
bolt analyze

run lint, typecheck, and dead-code checks over the current diff before handoff

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
      --staged      analyze staged changes only                           [boolean] [default: false]
      --branch      analyze changes since the merge base with a branch (defaults to the default
                    branch)                                                                 [string]
```
