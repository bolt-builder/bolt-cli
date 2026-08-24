# bolt pair

share a live session between two terminals

```
bolt pair

share a live session between two terminals

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
      --join        join a pair session on a running bolt server (e.g., http://localhost:4096)
                                                                                            [string]
  -s, --session     session id to join (defaults to the most recent session on the server)  [string]
      --port        port for the local server (defaults to a random port)      [number] [default: 0]
      --hostname    hostname for the local server                    [string] [default: "127.0.0.1"]
  -p, --password    basic auth password (defaults to OPENCODE_SERVER_PASSWORD)              [string]
  -u, --username    basic auth username (defaults to OPENCODE_SERVER_USERNAME or 'opencode')[string]
```
