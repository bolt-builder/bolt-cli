# bolt tighten [files..]

find loose types in changed code and propose stricter ones

```
bolt tighten [files..]

find loose types in changed code and propose stricter ones

Positionals:
  files  files to scan (defaults to the files changed in the current diff)     [array] [default: []]

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
      --branch      scan files changed since the merge base with a branch instead of the working
                    tree                                                                    [string]
      --suggest     ask the agent to propose stricter types for each finding
                                                                          [boolean] [default: false]
  -m, --model       model to use in the format of provider/model                            [string]
```
