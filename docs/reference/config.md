# bolt config

inspect and manage configuration

```
bolt config

inspect and manage configuration

Commands:
  bolt config diff               show what differs between local config files and the committed
                                 project config
  bolt config doctor             explain which config files loaded, in what order, and which source
                                 won each key
  bolt config edit               open the global config in $EDITOR
  bolt config get <key>          print the resolved config value at a dot path
  bolt config set <key> <value>  write a config value at a dot path (comments in .jsonc files are
                                 preserved)
  bolt config unset <key>        remove a config value at a dot path (comments in .jsonc files are
                                 preserved)

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

## bolt config diff

show what differs between local config files and the committed project config

```
bolt config diff

show what differs between local config files and the committed project config

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
      --patch       print a unified diff instead of per-key changes       [boolean] [default: false]
```

## bolt config doctor

explain which config files loaded, in what order, and which source won each key

```
bolt config doctor

explain which config files loaded, in what order, and which source won each key

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

## bolt config edit

open the global config in $EDITOR

```
bolt config edit

open the global config in $EDITOR

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

## bolt config get <key>

print the resolved config value at a dot path

```
bolt config get <key>

print the resolved config value at a dot path

Positionals:
  key  dot path, e.g. model or provider.anthropic.options.baseURL                [string] [required]

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

## bolt config set <key> <value>

write a config value at a dot path (comments in .jsonc files are preserved)

```
bolt config set <key> <value>

write a config value at a dot path (comments in .jsonc files are preserved)

Positionals:
  key    dot path, e.g. model                                                    [string] [required]
  value  value; parsed as JSON when valid, raw string otherwise                  [string] [required]

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
      --global      write to the global config file                       [boolean] [default: false]
```

## bolt config unset <key>

remove a config value at a dot path (comments in .jsonc files are preserved)

```
bolt config unset <key>

remove a config value at a dot path (comments in .jsonc files are preserved)

Positionals:
  key  dot path, e.g. model                                                      [string] [required]

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
      --global      edit the global config file                           [boolean] [default: false]
```
