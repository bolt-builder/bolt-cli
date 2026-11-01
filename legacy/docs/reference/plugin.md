# bolt plugin <module>

install plugin and update config [aliases: plug]

```
bolt plugin <module>

install plugin and update config

Positionals:
  module  npm module name                                                        [string] [required]

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
  -g, --global      install in global config                              [boolean] [default: false]
  -f, --force       replace existing plugin version                       [boolean] [default: false]
```
