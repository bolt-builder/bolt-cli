# bolt port <commit>

port a fix onto other branches with cherry-pick

```
bolt port <commit>

port a fix onto other branches with cherry-pick

Positionals:
  commit  the commit to port, e.g. the sha of a fix on dev                       [string] [required]

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
      --to          target branch to port onto (repeatable)         [array] [required] [default: []]
      --apply       create a port branch per target and cherry-pick onto it
                                                                          [boolean] [default: false]
      --push        push the created port branches to origin (plain push, never force)
                                                                          [boolean] [default: false]
```
