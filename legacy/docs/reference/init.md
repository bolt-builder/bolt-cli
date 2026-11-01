# bolt init [directory]

initialize bolt config, agents, and commands for a project

```
bolt init [directory]

initialize bolt config, agents, and commands for a project

Positionals:
  directory  project directory (defaults to the current directory)                          [string]

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
      --preset      seed config, agents, and commands for a project type
                                                 [string] [choices: "library", "webapp", "monorepo"]
```
