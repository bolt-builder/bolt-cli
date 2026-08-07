# bolt rebase

plan an interactive rebase with the agent and explain every decision

```
bolt rebase

plan an interactive rebase with the agent and explain every decision

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
      --onto        base ref to rebase onto (defaults to the merge base with the default branch)
                                                                                            [string]
      --apply       execute the plan (rewrites local history; never pushes)
                                                                          [boolean] [default: false]
  -m, --model       model to use in the format of provider/model                            [string]
```
