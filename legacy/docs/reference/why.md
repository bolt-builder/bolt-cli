# bolt why <question>

answer when and why a behavior changed, with commit evidence

```
bolt why <question>

answer when and why a behavior changed, with commit evidence

Positionals:
  question  the question, e.g. "when did retries stop being unlimited?"          [string] [required]

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
      --file        narrow the search to one file's history                                 [string]
      --lines       line range within --file, e.g. "120" or "120,160"                       [string]
      --term        search history for commits that added or removed this string (git pickaxe)
                                                                                            [string]
  -m, --model       model to use in the format of provider/model                            [string]
```
