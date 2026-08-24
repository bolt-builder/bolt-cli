# bolt models [provider]

list all available models

```
bolt models [provider]

list all available models

Positionals:
  provider  provider ID to filter models by                                                 [string]

Options:
  -h, --help        show help                                                              [boolean]
  -v, --version     show version number                                                    [boolean]
      --print-logs  print logs to stderr                                                   [boolean]
      --log-level   log level                   [string] [choices: "DEBUG", "INFO", "WARN", "ERROR"]
      --pure        run without external plugins                                           [boolean]
      --profile     use a named config profile                                              [string]
      --quiet       suppress non-essential output on stderr (errors still print)           [boolean]
      --verbose     use more verbose model output (includes metadata like costs)           [boolean]
      --offline     fail fast on network access instead of hanging                         [boolean]
      --refresh     refresh the models cache from models.dev                               [boolean]
      --json        emit a versioned JSON envelope on stdout: {"version":1,"ok":true,"result":...}
                    on success, {"version":1,"ok":false,"error":{"name":...,"message":...}} on
                    failure                                               [boolean] [default: false]
      --porcelain   guarantee line-oriented, grep-safe output that never changes shape between
                    versions (one record per line, tab-separated fields, first field is the record
                    kind)                                                 [boolean] [default: false]
```
