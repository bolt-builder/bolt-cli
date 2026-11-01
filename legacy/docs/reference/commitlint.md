# bolt commitlint

lint commit messages against this repo's own conventions

```
bolt commitlint

lint commit messages against this repo's own conventions

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
      --range       commit range to lint (defaults to the merge base with the default branch to
                    HEAD)                                                                   [string]
      --history     how many commits of history to learn the conventions from[number] [default: 200]
```
