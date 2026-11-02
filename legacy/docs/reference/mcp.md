# bolt mcp

manage MCP (Model Context Protocol) servers

```
bolt mcp

manage MCP (Model Context Protocol) servers

Commands:
  bolt mcp add [name]     add an MCP server
  bolt mcp list           list MCP servers and their status                            [aliases: ls]
  bolt mcp auth [name]    authenticate with an OAuth-enabled MCP server
  bolt mcp logout [name]  remove OAuth credentials for an MCP server
  bolt mcp debug <name>   debug OAuth connection for an MCP server

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

## bolt mcp add [name]

add an MCP server

```
bolt mcp add [name]

add an MCP server

Positionals:
  name  name of the MCP server                                                              [string]

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
      --url         URL for a remote MCP server                                             [string]
      --env         environment variable for a local MCP server (KEY=VALUE)                  [array]
      --header      HTTP header for a remote MCP server (KEY=VALUE)                          [array]
```

## bolt mcp list

list MCP servers and their status [aliases: ls]

```
bolt mcp list

list MCP servers and their status

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

## bolt mcp auth [name]

authenticate with an OAuth-enabled MCP server

```
bolt mcp auth [name]

authenticate with an OAuth-enabled MCP server

Commands:
  bolt mcp auth list  list OAuth-capable MCP servers and their auth status             [aliases: ls]

Positionals:
  name  name of the MCP server                                                              [string]

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

## bolt mcp logout [name]

remove OAuth credentials for an MCP server

```
bolt mcp logout [name]

remove OAuth credentials for an MCP server

Positionals:
  name  name of the MCP server                                                              [string]

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

## bolt mcp debug <name>

debug OAuth connection for an MCP server

```
bolt mcp debug <name>

debug OAuth connection for an MCP server

Positionals:
  name  name of the MCP server                                                   [string] [required]

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
