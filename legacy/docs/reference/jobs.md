# bolt jobs <action> [id]

manage background jobs started with run --background

```
bolt jobs <action> [id]

manage background jobs started with run --background

Positionals:
  action  list jobs, tail a job's output, kill a running job, or supervise one with restarts
                                  [string] [required] [choices: "list", "tail", "kill", "supervise"]
  id      job id (prefix match)                                                             [string]

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
  -f, --follow      with tail, stream new output as it is written         [boolean] [default: false]
      --health      with supervise, an http(s) URL to poll or a command whose exit code marks the
                    job healthy                                                             [string]
      --interval    with supervise, seconds between health polls               [number] [default: 5]
      --retries     with supervise, consecutive health failures before a restart
                                                                               [number] [default: 3]
      --limit       with supervise, maximum restarts before giving up          [number] [default: 5]
```
