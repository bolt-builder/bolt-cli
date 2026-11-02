# bolt refactor <instruction>

refactor with a test-verified loop: change, run, verify, repeat until green

```
bolt refactor <instruction>

refactor with a test-verified loop: change, run, verify, repeat until green

Positionals:
  instruction  refactor instruction for the agent                                [string] [required]

Options:
  -h, --help         show help                                                             [boolean]
  -v, --version      show version number                                                   [boolean]
      --print-logs   print logs to stderr                                                  [boolean]
      --log-level    log level                  [string] [choices: "DEBUG", "INFO", "WARN", "ERROR"]
      --pure         run without external plugins                                          [boolean]
      --profile      use a named config profile                                             [string]
      --quiet        suppress non-essential output on stderr (errors still print)          [boolean]
      --verbose      print debug logs to stderr (implies --print-logs and --log-level DEBUG)
                                                                                           [boolean]
      --offline      fail fast on network access instead of hanging                        [boolean]
      --test         test command that must exit 0 for the refactor to count as done
                                                                                 [string] [required]
      --attempts     maximum number of test-and-fix iterations                 [number] [default: 5]
  -m, --model        model to use in the format of provider/model                           [string]
      --confidence   ask the model to report how confident it is in the refactor
                                                                          [boolean] [default: false]
      --self-review  review the resulting diff with the code-review agent once tests are green
                                                                          [boolean] [default: false]
```
