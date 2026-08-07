# bolt stats

show token usage and cost statistics

```
bolt stats

show token usage and cost statistics

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
      --days        show stats for the last N days (default: all time)                      [number]
      --tools       number of tools to show (default: all)                                  [number]
      --models      show model statistics (default: hidden). Pass a number to show top N, otherwise
                    shows all
      --project     filter by project (default: all projects, empty string: current project)[string]
      --json        emit a versioned JSON envelope on stdout: {"version":1,"ok":true,"result":...}
                    on success, {"version":1,"ok":false,"error":{"name":...,"message":...}} on
                    failure                                               [boolean] [default: false]
      --porcelain   guarantee line-oriented, grep-safe output that never changes shape between
                    versions (one record per line, tab-separated fields, first field is the record
                    kind)                                                 [boolean] [default: false]
```
