# bolt drift

flag READMEs and comments that the current diff just made stale

```
bolt drift

flag READMEs and comments that the current diff just made stale

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
      --staged      inspect staged changes only                           [boolean] [default: false]
      --branch      inspect changes since the merge base with a branch (defaults to the default
                    branch)                                                                 [string]
```
