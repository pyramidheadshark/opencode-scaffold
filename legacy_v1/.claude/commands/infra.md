# /infra — Show Infrastructure Manifest

Reads and displays the full INFRA.yaml manifest for this project.

## Usage

Type `/infra` in Claude Code to see the complete infrastructure manifest including VMs, services, rules, and IPs.

## Instructions for Claude Code

When this command is invoked:

1. Read `INFRA.yaml` from the project root. If not found, try `.claude/INFRA.yaml`.
2. If neither exists, say: "No INFRA.yaml found. Create one from the template: `cp templates/INFRA.yaml ./INFRA.yaml`"
3. Display the full YAML content formatted as a code block.
4. After displaying, summarize: VM count, service count, and list all rules.
5. Remind: "VPC IPs in this manifest are the source of truth — never guess IPs from memory."
