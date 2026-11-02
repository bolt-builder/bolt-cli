# bolt cron <action> [args..]

schedule recurring agent chores (dependency bumps, triage, drafts)

```
bolt cron <action> [args..]

schedule recurring agent chores (dependency bumps, triage, drafts)

Positionals:
  action  add a schedule, list them, remove one, or start the scheduler
                                         [string] [required] [choices: "add", "list", "rm", "start"]
  args    add: "<schedule>" "<prompt>"; rm: <id>                               [array] [default: []]

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
```
