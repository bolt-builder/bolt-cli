# bolt logs

print the agent log

```
bolt logs

print the agent log

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
      --tail        number of trailing lines to print                       [number] [default: 1000]
  -f, --follow      stream new log lines as they are written              [boolean] [default: false]
      --level       minimum log level to show   [string] [choices: "DEBUG", "INFO", "WARN", "ERROR"]
      --session     only show lines mentioning this session ID                              [string]
      --json        emit a versioned JSON envelope on stdout: {"version":1,"ok":true,"result":...}
                    on success, {"version":1,"ok":false,"error":{"name":...,"message":...}} on
                    failure                                               [boolean] [default: false]
      --porcelain   guarantee line-oriented, grep-safe output that never changes shape between
                    versions (one record per line, tab-separated fields, first field is the record
                    kind)                                                 [boolean] [default: false]
```
