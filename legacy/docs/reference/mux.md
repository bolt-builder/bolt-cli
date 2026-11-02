# bolt mux [dirs..]

run parallel bolt sessions in tmux split panes

```
bolt mux [dirs..]

run parallel bolt sessions in tmux split panes

Positionals:
  dirs  directories to open, one pane each (defaults to --count panes in the current directory)
                                                                               [array] [default: []]

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
  -n, --count       number of panes when no directories are given              [number] [default: 2]
      --layout      tmux layout for the panes
                  [string] [choices: "tiled", "even-horizontal", "even-vertical", "main-horizontal",
                                                                 "main-vertical"] [default: "tiled"]
      --name        tmux session name when starting outside tmux          [string] [default: "bolt"]
```
