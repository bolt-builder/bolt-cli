# bolt review

review code changes with the code-review agent

```
bolt review

review code changes with the code-review agent

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
      --staged      review staged changes only                            [boolean] [default: false]
      --branch      review changes since the merge base with a branch (defaults to the default
                    branch)                                                                 [string]
  -m, --model       model to use in the format of provider/model                            [string]
      --confidence  ask the model to report how confident it is in the review
                                                                          [boolean] [default: false]
      --json        emit a versioned JSON envelope on stdout: {"version":1,"ok":true,"result":...}
                    on success, {"version":1,"ok":false,"error":{"name":...,"message":...}} on
                    failure                                               [boolean] [default: false]
      --porcelain   guarantee line-oriented, grep-safe output that never changes shape between
                    versions (one record per line, tab-separated fields, first field is the record
                    kind)                                                 [boolean] [default: false]

exit codes: 0 pass, 1 fail verdict, 2 no verdict determined
```
