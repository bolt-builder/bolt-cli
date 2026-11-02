# bolt asserts [files..]

find tests with missing or weak assertions and suggest better ones

```
bolt asserts [files..]

find tests with missing or weak assertions and suggest better ones

Positionals:
  files  test files to scan (defaults to the test files changed in the current diff)
                                                                               [array] [default: []]

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
      --branch      scan test files changed since the merge base with a branch instead of the
                    working tree                                                            [string]
      --suggest     ask the agent to suggest the missing assertions       [boolean] [default: false]
  -m, --model       model to use in the format of provider/model                            [string]
```
