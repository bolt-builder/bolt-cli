# bolt fork <sessionID> [messageID]

fork a session at any message and continue down a different path

```
bolt fork <sessionID> [messageID]

fork a session at any message and continue down a different path

Positionals:
  sessionID  session id to fork                                                  [string] [required]
  messageID  fork at this message (inclusive); defaults to the full history                 [string]

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
      --resume      open the fork interactively right away                [boolean] [default: false]
```
