# bolt run [message..]

run bolt with a message

```
bolt run [message..]

run bolt with a message

Positionals:
  message  message to send                                                     [array] [default: []]

Options:
  -h, --help              show help                                                        [boolean]
  -v, --version           show version number                                              [boolean]
      --print-logs        print logs to stderr                                             [boolean]
      --log-level         log level             [string] [choices: "DEBUG", "INFO", "WARN", "ERROR"]
      --pure              run without external plugins                                     [boolean]
      --profile           use a named config profile                                        [string]
      --quiet             suppress non-essential output on stderr (errors still print)     [boolean]
      --verbose           print debug logs to stderr (implies --print-logs and --log-level DEBUG)
                                                                                           [boolean]
      --offline           fail fast on network access instead of hanging                   [boolean]
      --command           the command to run, use message for args                          [string]
  -c, --continue          continue the last session                                        [boolean]
  -s, --session           session id to continue                                            [string]
      --fork              fork the session before continuing (requires --continue or --session)
                                                                                           [boolean]
      --share             share the session                                                [boolean]
  -m, --model             model to use in the format of provider/model (or 'auto' for cheapest
                          available)                                                        [string]
      --best-of           comma-separated provider/model list: run the same task on every model in
                          parallel, rank the results with a judge (--model, or the first entry),
                          keep the winner                                                   [string]
      --agent             agent to use (or 'auto' for automatic selection)                  [string]
      --auto-agent        route the prompt to the best matching agent based on agent descriptions
                                                                          [boolean] [default: false]
      --format            format: default (formatted) or json (raw JSON events)
                                          [string] [choices: "default", "json"] [default: "default"]
      --json              emit a versioned JSON envelope on stdout:
                          {"version":1,"ok":true,"result":...} on success,
                          {"version":1,"ok":false,"error":{"name":...,"message":...}} on failure
                                                                          [boolean] [default: false]
      --porcelain         guarantee line-oriented, grep-safe output that never changes shape between
                          versions (one record per line, tab-separated fields, first field is the
                          record kind)                                    [boolean] [default: false]
      --emit              emit machine-consumable output on stdout after the run: 'context' prints
                          the run's findings so they can be piped into another run (`bolt run ...
                          --emit context | bolt run ...`)              [string] [choices: "context"]
  -f, --file              file(s) to attach to message                                       [array]
      --title             title for the session (uses truncated prompt if no value provided)[string]
      --max-cost          abort the run once its cost in USD reaches this budget            [number]
      --timeout           abort the run after this many seconds, capturing any partial result
                                                                                            [number]
      --retries           retry a failed or timed-out run this many times      [number] [default: 0]
      --max-tokens        abort the run once its total token usage reaches this budget      [number]
      --output-schema     JSON Schema file the final answer must validate against (retries until it
                          does, bounded)                                                    [string]
      --cost-report       report per-run tokens, cache hits, dollars, and wall time to stderr (or as
                          a cost_report JSON event)                       [boolean] [default: false]
      --attach            attach to a running bolt server (e.g., http://localhost:4096), or inject
                          file/dir paths as context without mentioning them in the prompt
                          (repeatable)                                                       [array]
      --host              run the agent on a remote machine over ssh (e.g., ssh://dev-box); requires
                          bolt preinstalled on the remote                                   [string]
      --voice             record a voice prompt and transcribe it locally with whisper.cpp (press
                          Enter to stop)                                  [boolean] [default: false]
  -p, --password          basic auth password (defaults to OPENCODE_SERVER_PASSWORD)        [string]
  -u, --username          basic auth username (defaults to OPENCODE_SERVER_USERNAME or 'opencode')
                                                                                            [string]
      --dir               directory to run in, path on remote server if attaching           [string]
      --port              port for the local server (defaults to random port if no value provided)
                                                                                            [number]
      --variant           model variant (provider-specific reasoning effort, e.g., high, max,
                          minimal)                                                          [string]
      --thinking          show thinking blocks                                             [boolean]
  -i, --interactive       run in direct interactive split-footer mode     [boolean] [default: false]
      --auto              auto-approve permissions that are not explicitly denied (dangerous!)
                                                                          [boolean] [default: false]
      --dry-run           show every file write and command the plan would execute without doing it
                                                                          [boolean] [default: false]
      --plan-only         CI gate: dry-run the prompt, print the full intended diff and commands,
                          and exit nonzero if anything looks destructive  [boolean] [default: false]
      --background, --bg  run detached as a background job (manage with bolt jobs list/tail/kill)
                                                                          [boolean] [default: false]

exit codes: 0 success, 1 failure, 3 budget hit (--max-cost/--max-tokens)
```
