# bolt commit

commit staged changes with a generated message

```
bolt commit

commit staged changes with a generated message

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
  -a, --all         commit all tracked changes, not just staged ones      [boolean] [default: false]
      --dry-run     print the generated message without committing        [boolean] [default: false]
  -m, --model       model to use in the format of provider/model                            [string]
```
