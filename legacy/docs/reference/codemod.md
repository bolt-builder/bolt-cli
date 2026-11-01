# bolt codemod [description]

generate an ast-grep transform, preview the diff, and apply it with --apply

```
bolt codemod [description]

generate an ast-grep transform, preview the diff, and apply it with --apply

Positionals:
  description  natural language description of the transform to generate                    [string]

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
      --pattern     explicit ast-grep pattern; skips the agent (requires --rewrite)         [string]
      --rewrite     explicit ast-grep rewrite; skips the agent (requires --pattern)         [string]
      --lang        ast-grep language identifier, e.g. typescript, tsx, python              [string]
      --apply       write the rewrites to disk (default is preview only)  [boolean] [default: false]
  -m, --model       model to use in the format of provider/model                            [string]
```
