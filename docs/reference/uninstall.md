# bolt uninstall

uninstall bolt and remove all related files

```
bolt uninstall

uninstall bolt and remove all related files

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
  -c, --keep-config  keep configuration files                             [boolean] [default: false]
  -d, --keep-data    keep session data and snapshots                      [boolean] [default: false]
      --dry-run      show what would be removed without removing          [boolean] [default: false]
  -f, --force        skip confirmation prompts                            [boolean] [default: false]
```
