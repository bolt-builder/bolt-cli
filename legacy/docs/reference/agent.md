# bolt agent

manage agents

```
bolt agent

manage agents

Commands:
  bolt agent create  create a new agent
  bolt agent list    list all available agents

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

## bolt agent create

create a new agent

```
bolt agent create

create a new agent

Options:
  -h, --help                  show help                                                    [boolean]
  -v, --version               show version number                                          [boolean]
      --print-logs            print logs to stderr                                         [boolean]
      --log-level             log level         [string] [choices: "DEBUG", "INFO", "WARN", "ERROR"]
      --pure                  run without external plugins                                 [boolean]
      --profile               use a named config profile                                    [string]
      --quiet                 suppress non-essential output on stderr (errors still print) [boolean]
      --verbose               print debug logs to stderr (implies --print-logs and --log-level
                              DEBUG)                                                       [boolean]
      --offline               fail fast on network access instead of hanging               [boolean]
      --path                  directory path to generate the agent file                     [string]
      --description           what the agent should do                                      [string]
      --mode                  agent mode            [string] [choices: "all", "primary", "subagent"]
      --permissions, --tools  comma-separated list of permissions to allow (default: all).
                              Available: "bash, read, edit, glob, grep, webfetch, task, todowrite,
                              websearch, lsp, skill"                                        [string]
  -m, --model                 model to use in the format of provider/model                  [string]
```

## bolt agent list

list all available agents

```
bolt agent list

list all available agents

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
