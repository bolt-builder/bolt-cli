# bolt index [query]

build an incrementally updated whole-repo vector index and query it

```
bolt index [query]

build an incrementally updated whole-repo vector index and query it

Positionals:
  query  search the index instead of only building it                                       [string]

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
      --out         index file path                        [string] [default: "codebase-index.json"]
      --limit       maximum search hits                                       [number] [default: 10]
      --watch       keep running and reindex files as they are saved      [boolean] [default: false]
```
