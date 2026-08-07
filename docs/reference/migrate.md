# bolt migrate [package] [target]

generate a major-version upgrade playbook for a dependency

```
bolt migrate [package] [target]

generate a major-version upgrade playbook for a dependency

Positionals:
  package  dependency to upgrade; omit to list applicable curated playbooks                 [string]
  target   target major version, defaults to one hop up                                     [number]

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
```
