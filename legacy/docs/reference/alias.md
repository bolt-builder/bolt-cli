# bolt alias [entry]

list aliases, show one, or set one with name="expansion"

```
bolt alias [entry]

list aliases, show one, or set one with name="expansion"

Positionals:
  entry  alias name to show, or name="run --agent reviewer ..." to set                      [string]

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
      --rm          remove the alias                                      [boolean] [default: false]

Examples:
  bolt alias deploy-check="run --agent reviewer       persist an alias
  'audit the deploy diff'"
  bolt alias                                          list aliases
  bolt alias --rm deploy-check                        remove an alias
```
