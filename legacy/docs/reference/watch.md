# bolt watch <command>

rerun a command on every file change, optionally fixing failures with the agent

```
bolt watch <command>

rerun a command on every file change, optionally fixing failures with the agent

Positionals:
  command  command to run when files change, e.g. "bun test"                     [string] [required]

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
      --fix         send failures to the agent so it can fix them         [boolean] [default: false]
      --attempts    max consecutive fix attempts before waiting for a manual change
                                                                               [number] [default: 3]
  -m, --model       model to use for fixes in the format of provider/model                  [string]
```
