# bolt upgrade [target]

upgrade bolt to the latest or a specific version [aliases: update]

```
bolt upgrade [target]

upgrade bolt to the latest or a specific version

Positionals:
  target  version to upgrade to, for ex '0.1.48' or 'v0.1.48'                               [string]

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
  -m, --method      installation method to use
                          [string] [choices: "curl", "npm", "pnpm", "bun", "brew", "choco", "scoop"]
      --channel     release channel to follow        [string] [choices: "stable", "beta", "nightly"]
      --undo        roll back to the previously installed version                          [boolean]
```
