# Bolt Run action

Composite action that installs Bolt (with caching) and runs a single headless `bolt run` prompt inside a workflow job. Unlike the mention-driven action in `github/`, this one is made for unattended CI steps: nightly maintenance, PR gates, scheduled reports.

## Usage

```yaml
jobs:
  bolt:
    runs-on: blacksmith-4vcpu-ubuntu-2404
    steps:
      - uses: actions/checkout@v4
      - uses: bolt-builder/bolt-cli/.github/actions/bolt@dev
        env:
          OPENCODE_API_KEY: ${{ secrets.OPENCODE_API_KEY }}
        with:
          prompt: "Summarize the failures in the latest test run and propose fixes"
          model: opencode/claude-fable-5
```

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `prompt` | required | Prompt passed to `bolt run` |
| `model` | | `provider/model`, or `auto` |
| `agent` | | Primary agent to use |
| `variant` | | Provider-specific reasoning effort |
| `version` | `latest` | Bolt release tag to install |
| `working-directory` | `.` | Directory to run in |
| `format` | `default` | `default` or `json` (raw event stream) |
| `extra-args` | | Extra `bolt run` flags, e.g. `--max-cost 2` |

## Caching

Two caches keep repeat runs fast:

- `~/.bolt/bin` keyed on OS, architecture, and the resolved release tag, so the binary installs once per version.
- `~/.cache/opencode` (runtime metadata such as model catalogs) keyed on OS and version with an OS-prefixed restore key.

## Auth

Provide provider credentials as environment variables on the step (for example `OPENCODE_API_KEY` or `ANTHROPIC_API_KEY`). The action never handles secrets itself.
