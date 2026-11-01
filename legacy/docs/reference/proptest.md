# bolt proptest <file>

generate property-based tests for the pure functions in a file

```
bolt proptest <file>

generate property-based tests for the pure functions in a file

Positionals:
  file  source file whose exported pure functions should get property tests      [string] [required]

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
      --name        only target the exported function with this name                        [string]
  -m, --model       model to use in the format of provider/model                            [string]
```
