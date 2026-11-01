# bolt mutate <file>

mutate a file and rerun the tests to prove they catch bugs

```
bolt mutate <file>

mutate a file and rerun the tests to prove they catch bugs

Positionals:
  file  source file to mutate                                                    [string] [required]

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
  -c, --command     test command to run per mutant (detected from the project when omitted) [string]
  -n, --limit       maximum number of mutants to test                         [number] [default: 25]
      --timeout     per-run timeout in milliseconds                       [number] [default: 120000]
```
