# bolt flaky <command>

detect flaky tests by rerunning a command, and quarantine offenders

```
bolt flaky <command>

detect flaky tests by rerunning a command, and quarantine offenders

Positionals:
  command  test command to rerun, e.g. "bun test ./test/foo.test.ts"             [string] [required]

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
  -n, --runs        number of repetitions                                     [number] [default: 10]
  -q, --quarantine  record the command in .bolt/quarantine.json when it turns out flaky
                                                                          [boolean] [default: false]
```
