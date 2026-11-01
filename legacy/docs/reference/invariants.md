# bolt invariants <action> [files..]

state invariants before a refactor and verify them after

```
bolt invariants <action> [files..]

state invariants before a refactor and verify them after

Positionals:
  action  state invariants before refactoring, or verify them afterwards
                                                    [string] [required] [choices: "state", "verify"]
  files   files about to be refactored (state only)                            [array] [default: []]

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
      --range       git diff range for verify (defaults to HEAD, i.e. uncommitted changes)  [string]
  -m, --model       model to use in the format of provider/model                            [string]
```
