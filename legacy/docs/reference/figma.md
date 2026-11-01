# bolt figma <url>

generate components from a Figma design node

```
bolt figma <url>

generate components from a Figma design node

Positionals:
  url  Figma file or design URL including a node-id                              [string] [required]

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
      --out         directory to write generated components to (defaults to the current directory)
                                                                                            [string]
  -m, --model       model to use in the format of provider/model                            [string]
```
