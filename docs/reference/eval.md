# bolt eval [paths..]

run agent evaluation cases and grade the results

```
bolt eval [paths..]

run agent evaluation cases and grade the results

Positionals:
  paths  eval case files or directories (default: ./evals)              [array] [default: ["evals"]]

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
  -m, --model       default model in provider/model format (cases can override)             [string]
      --agent       default agent (cases can override)                                      [string]
      --format      format: default (formatted) or json (one JSON object per line)
                                          [string] [choices: "default", "json"] [default: "default"]
      --timeout     per-case timeout in seconds (cases can override)         [number] [default: 300]
      --keep        keep case workspaces on disk for debugging            [boolean] [default: false]

exit codes: 0 all passed, 1 a case failed, 5 a case timed out
```
