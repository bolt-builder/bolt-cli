# bolt bisect <command>

find the commit that broke a command, show blame, and propose a fix

```
bolt bisect <command>

find the commit that broke a command, show blame, and propose a fix

Positionals:
  command  command that fails on HEAD, e.g. "bun test ./test/foo.test.ts"        [string] [required]

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
  -g, --good        a ref where the command still passed, e.g. origin/dev~20     [string] [required]
      --fix         ask the agent to analyze the culprit and propose a patch
                                                                          [boolean] [default: false]
  -m, --model       model to use for the fix proposal in the format of provider/model       [string]
```
