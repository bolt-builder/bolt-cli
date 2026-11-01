# bolt diff-gate

review a diff from stdin and exit 1 when defects reach a severity threshold

```
bolt diff-gate

review a diff from stdin and exit 1 when defects reach a severity threshold

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
      --threshold   lowest severity that fails the gate
                                 [string] [choices: "minor", "major", "critical"] [default: "major"]
  -m, --model       model to use in the format of provider/model                            [string]
```
