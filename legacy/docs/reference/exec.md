# bolt exec

run a markdown playbook of steps non-interactively, stopping on the first failure

```
bolt exec

run a markdown playbook of steps non-interactively, stopping on the first failure

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
  -f, --file        markdown playbook file to execute                            [string] [required]
  -m, --model       model to use in the format of provider/model                            [string]
      --agent       agent to use for every step                                             [string]
```
