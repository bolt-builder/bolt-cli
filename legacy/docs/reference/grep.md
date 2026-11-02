# bolt grep <pattern>

full-text search across every session transcript on disk

```
bolt grep <pattern>

full-text search across every session transcript on disk

Positionals:
  pattern  regular expression to search for                                      [string] [required]

Options:
  -h, --help         show help                                                             [boolean]
  -v, --version      show version number                                                   [boolean]
      --print-logs   print logs to stderr                                                  [boolean]
      --log-level    log level                  [string] [choices: "DEBUG", "INFO", "WARN", "ERROR"]
      --pure         run without external plugins                                          [boolean]
      --profile      use a named config profile                                             [string]
      --quiet        suppress non-essential output on stderr (errors still print)          [boolean]
      --verbose      print debug logs to stderr (implies --print-logs and --log-level DEBUG)
                                                                                           [boolean]
      --offline      fail fast on network access instead of hanging                        [boolean]
  -i, --ignore-case  case-insensitive matching                            [boolean] [default: false]
      --limit        stop after this many matching lines                                    [number]
      --json         output matches as JSON                               [boolean] [default: false]
```
