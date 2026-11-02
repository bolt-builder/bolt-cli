# bolt batch <file>

run a queue of prompts sequentially or in parallel with a summary table

```
bolt batch <file>

run a queue of prompts sequentially or in parallel with a summary table

Positionals:
  file  file with one prompt per line (# comments, backslash continuations)      [string] [required]

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
      --parallel    number of prompts to run concurrently                      [number] [default: 1]
  -m, --model       model to use in the format of provider/model                            [string]
      --agent       agent to use for every prompt                                           [string]
```
