# bolt session

manage sessions [aliases: sessions]

```
bolt session

manage sessions

Commands:
  bolt session list                            list sessions                           [aliases: ls]
  bolt session delete <sessionID>              delete a session
  bolt session branch <sessionID> [messageID]  branch a session into a new one sharing its prefix
  bolt session tag <sessionID> [tags..]        add, remove, or list session tags
  bolt session prune                           archive sessions older than a retention window

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

## bolt session list

list sessions [aliases: ls]

```
bolt session list

list sessions

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
  -n, --max-count   limit to N most recent sessions                                         [number]
      --since       only sessions updated after this date or relative duration (e.g. 24h, 7d)
                                                                                            [string]
      --project     search all projects, filtered by project name, worktree path, or id substring
                                                                                            [string]
      --failed      only sessions whose latest assistant message ended in an error
                                                                          [boolean] [default: false]
      --sort        sort order
                      [string] [choices: "updated", "created", "title", "cost"] [default: "updated"]
      --json        output as JSON (same as --format json)                [boolean] [default: false]
      --tag         only sessions carrying this tag                                         [string]
      --format      output format             [string] [choices: "table", "json"] [default: "table"]
```

## bolt session delete <sessionID>

delete a session

```
bolt session delete <sessionID>

delete a session

Positionals:
  sessionID  session ID to delete                                                [string] [required]

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

## bolt session branch <sessionID> [messageID]

branch a session into a new one sharing its prefix

```
bolt session branch <sessionID> [messageID]

branch a session into a new one sharing its prefix

Positionals:
  sessionID  session ID to branch from                                           [string] [required]
  messageID  branch at this message (inclusive); defaults to the full history               [string]

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

## bolt session tag <sessionID> [tags..]

add, remove, or list session tags

```
bolt session tag <sessionID> [tags..]

add, remove, or list session tags

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

## bolt session prune

archive sessions older than a retention window

```
bolt session prune

archive sessions older than a retention window

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
      --days        archive sessions not updated in this many days            [number] [default: 30]
      --dry-run     list the sessions that would be archived without archiving them
                                                                          [boolean] [default: false]
```
