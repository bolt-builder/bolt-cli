# bolt stack

split the current branch into an ordered stack of reviewable branches

```
bolt stack

split the current branch into an ordered stack of reviewable branches

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
      --base        base ref for the stack (defaults to the default branch)                 [string]
      --apply       create the stack branches locally                     [boolean] [default: false]
      --push        push the created branches to origin (implies --apply; plain push, never force)
                                                                          [boolean] [default: false]
  -m, --model       model to use in the format of provider/model                            [string]
```
