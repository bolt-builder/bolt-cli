# bolt bench <command>

benchmark a command on this change and on the base ref, and flag regressions

```
bolt bench <command>

benchmark a command on this change and on the base ref, and flag regressions

Positionals:
  command  command to time, e.g. "bun test ./test/hot.test.ts"                   [string] [required]

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
  -b, --base        ref to compare against (defaults to the merge base with the default branch)
                                                                                            [string]
  -n, --runs        timed runs per side                                        [number] [default: 5]
      --warmup      untimed warmup runs per side                               [number] [default: 1]
  -t, --threshold   percentage slowdown that counts as a regression           [number] [default: 10]
```
