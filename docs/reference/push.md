# bolt push <sessionID> <url>

push a session to a bolt server on another machine

```
bolt push <sessionID> <url>

push a session to a bolt server on another machine

Positionals:
  sessionID  session id to push                                                  [string] [required]
  url        remote bolt server url (start one there with: bolt serve)           [string] [required]

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
  -p, --password    basic auth password (defaults to OPENCODE_SERVER_PASSWORD)              [string]
  -u, --username    basic auth username (defaults to OPENCODE_SERVER_USERNAME or 'opencode')[string]
      --dir         project directory on the remote machine (defaults to the remote server's working
                    directory)                                                              [string]
```
