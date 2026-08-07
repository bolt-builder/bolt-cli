# bolt web

start bolt server and open web interface

```
bolt web

start bolt server and open web interface

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
      --port         port to listen on                                         [number] [default: 0]
      --hostname     hostname to listen on                           [string] [default: "127.0.0.1"]
      --mdns         enable mDNS service discovery (defaults hostname to 0.0.0.0)
                                                                          [boolean] [default: false]
      --mdns-domain  custom domain name for mDNS service (default: opencode.local)
                                                                [string] [default: "opencode.local"]
      --cors         additional domains to allow for CORS                      [array] [default: []]
```
