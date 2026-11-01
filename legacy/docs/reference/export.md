# bolt export [sessionID]

export session data as JSON, markdown, JSONL, or an HTML replay

```
bolt export [sessionID]

export session data as JSON, markdown, JSONL, or an HTML replay

Positionals:
  sessionID  session id to export                                                           [string]

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
      --sanitize    redact sensitive transcript and file data                              [boolean]
      --html        write a self-contained HTML replay instead of JSON                     [boolean]
      --md          print the transcript as clean markdown                                 [boolean]
      --jsonl       print one JSON message per line for piping                             [boolean]
      --out         output file for the HTML replay                [string] [default: "replay.html"]
      --json        emit a versioned JSON envelope on stdout: {"version":1,"ok":true,"result":...}
                    on success, {"version":1,"ok":false,"error":{"name":...,"message":...}} on
                    failure                                               [boolean] [default: false]
      --porcelain   guarantee line-oriented, grep-safe output that never changes shape between
                    versions (one record per line, tab-separated fields, first field is the record
                    kind)                                                 [boolean] [default: false]
```
