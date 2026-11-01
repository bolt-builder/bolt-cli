# bolt hotspots

flag files with high churn and high complexity for refactoring

```
bolt hotspots

flag files with high churn and high complexity for refactoring

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
      --since       history window, any git-parseable date             [string] [default: "90 days"]
      --limit       maximum files to report                                   [number] [default: 20]
```
