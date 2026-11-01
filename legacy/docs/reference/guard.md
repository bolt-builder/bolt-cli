# bolt guard <bug>

generate a failing regression test from a bug description before fixing it

```
bolt guard <bug>

generate a failing regression test from a bug description before fixing it

Positionals:
  bug  bug description, e.g. "parse() drops the last row when the file has no trailing newline"
                                                                                 [string] [required]

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
  -m, --model       model to use in the format of provider/model                            [string]
```
