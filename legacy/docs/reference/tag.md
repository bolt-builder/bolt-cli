# bolt tag <sessionID> [tags..]

tag a session (alias of session tag)

```
bolt tag <sessionID> [tags..]

tag a session (alias of session tag)

Positionals:
  sessionID  session id to tag                                                   [string] [required]
  tags       tags to add; omit to list the session's tags                      [array] [default: []]

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
      --remove      remove the given tags instead of adding them          [boolean] [default: false]
```
