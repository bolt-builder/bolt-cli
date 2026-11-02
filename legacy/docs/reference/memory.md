# bolt memory

inspect project memory

```
bolt memory

inspect project memory

Commands:
  bolt memory why <question>         ask why the agent believes something and where it learned it
  bolt memory team <action> [query]  opt-in shared project memory committed to the repository
  bolt memory diff                   show memory staged by sessions before it persists
  bolt memory review <mode>          toggle review mode for auto-captured memory
  bolt memory search <query>         search everything stored in project memory
  bolt memory conflicts              detect and resolve contradictory facts in project memory
  bolt memory export                 export project memory as a single markdown document
  bolt memory import <file>          import memory entries from an exported markdown document

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

## bolt memory why <question>

ask why the agent believes something and where it learned it

```
bolt memory why <question>

ask why the agent believes something and where it learned it

Positionals:
  question  what to ask stored memory about                                      [string] [required]

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
  -m, --model       model to use in the format of provider/model                            [string]
```

## bolt memory team <action> [query]

opt-in shared project memory committed to the repository

```
bolt memory team <action> [query]

opt-in shared project memory committed to the repository

Positionals:
  action  init creates .bolt/memory.md; share copies matching facts into it
                                                      [string] [required] [choices: "init", "share"]
  query   key or id of the fact to share                                                    [string]

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

## bolt memory diff

show memory staged by sessions before it persists

```
bolt memory diff

show memory staged by sessions before it persists

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
      --apply       persist the staged memory                             [boolean] [default: false]
      --discard     drop the staged memory                                [boolean] [default: false]
```

## bolt memory review <mode>

toggle review mode for auto-captured memory

```
bolt memory review <mode>

toggle review mode for auto-captured memory

Positionals:
  mode  on to stage session captures for review, off to persist them directly
                                                          [string] [required] [choices: "on", "off"]

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

## bolt memory search <query>

search everything stored in project memory

```
bolt memory search <query>

search everything stored in project memory

Positionals:
  query  what to search stored memory for                                        [string] [required]

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
  -n, --limit       maximum results to print                                  [number] [default: 10]
```

## bolt memory conflicts

detect and resolve contradictory facts in project memory

```
bolt memory conflicts

detect and resolve contradictory facts in project memory

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
      --fix         apply automatic resolutions (corrections win, else the newer fact)
                                                                          [boolean] [default: false]
```

## bolt memory export

export project memory as a single markdown document

```
bolt memory export

export project memory as a single markdown document

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
  -o, --out         write the export to a file instead of stdout                            [string]
```

## bolt memory import <file>

import memory entries from an exported markdown document

```
bolt memory import <file>

import memory entries from an exported markdown document

Positionals:
  file  path to a markdown export produced by bolt memory export                 [string] [required]

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
