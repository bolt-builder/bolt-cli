# bolt resolve [file..]

resolve merge conflicts by intent with the agent

```
bolt resolve [file..]

resolve merge conflicts by intent with the agent

Positionals:
  file  conflicted files to resolve (defaults to every unmerged file)          [array] [default: []]

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
      --apply       write resolutions to the worktree and stage them      [boolean] [default: false]
  -m, --model       model to use in the format of provider/model                            [string]
```
