# Personal AI Firewall

An adaptive security layer for personal AI agents. It compiles plain-language privacy rules into enforceable policies, detects and redacts sensitive data (including India-specific identifiers), gates risky tool calls, and continuously hardens itself through a self-healing red-team loop.

Built with NVIDIA Nemotron on Nebius Token Factory.

---

## Problem

Personal AI agents with access to email, files, the web, and even bank statements are useful only because they hold sensitive data. That same data can leak through prompt injection, indirect injection (poisoned PDFs, web pages, or tool outputs), and over-permissive tool calls.

Most projects build the agent itself and neglect the security layer in its path. The few that do build one rely on static rules, which become outdated as new attacks emerge.

## Overview

Personal AI Firewall sits between an agent and its tools and data. Every tool call and data flow passes through it.

```
                +--------------------+
                |   Protected Agent  |
                +---------+----------+
                          |
                          v
+-------------------------------------------------------+
|                  Personal AI Firewall                 |
|                                                       |
|  Proxy / MCP Interception                             |
|        |                                              |
|        v                                              |
|  Data Guardian --> Policy Engine --> Action Gate      |
|        |                                  |           |
|        v                                  v           |
|  Encrypted Vault                  Human Approval      |
|                                                       |
|  Audit Log (hash-chained)    Red-Team Loop (offline)  |
+---------------------------+---------------------------+
                            |
                            v
                +-----------------------+
                |  Tools (OpenShell     |
                |  sandbox, allowlists) |
                +-----------------------+
```

## Key Features

### 1. Policy Engine (natural language to executable policy)
- Users write rules in plain language, for example: *"Never send account numbers or balances from my bank statements to any external tool."*
- Nemotron Ultra compiles each rule into a structured YAML/JSON policy and enumerates its edge cases.
- Output is validated with Pydantic; LLM output is never executed directly.
- Z3-based conflict and shadowed-rule detection. Full formal verification is out of scope.
- Git-style policy versioning with single-command rollback.

### 2. Data Guardian (multi-stage sensitive data detection)
Checks run from cheapest to most expensive:
1. **Deterministic layer:** regular expressions with checksum validation. Aadhaar (Verhoeff), PAN, IFSC, UPI IDs, phone numbers, email addresses, card numbers (Luhn), and API keys or secrets.
2. **NER layer:** Microsoft Presidio with custom recognizers, tested on Hindi and Hinglish inputs.
3. **Context layer:** Nemotron Nano resolves ambiguous cases (for example, a 10-digit number in a bank statement versus arbitrary text).

Actions on detection:
- **Redact:** `[REDACTED:ACCOUNT_NO]`
- **Tokenize:** a reversible token is issued; the original value stays in a local Fernet-encrypted vault.
- **Synthetic replacement:** a format-preserving fake value is substituted when the agent requires a valid-looking value.
- **Lineage:** every sensitive value is tracked by source document, handling agent, and destination.

### 3. Action Gate
Each tool call receives a risk score based on data sensitivity, destination trust, action type, and policy match.

| Level | Action |
|---|---|
| Low | Allow automatically |
| Medium | Allow, with silent logging and a soft notification |
| High | Block and request human approval, with a clear explanation |
| Critical | Block and terminate the session (kill switch) |

Example approval prompt: *"This tool call is sending your PAN number to an external email tool. Allow, deny, or allow with redaction?"*

### 4. Living Red-Team and Self-Healing Loop
The key differentiator of this project.
- **Attacker** (Nemotron Super/Nano) generates direct injection, indirect injection (poisoned PDFs, HTML, tool output), exfiltration via markdown images or URLs, policy bypass, and multi-agent collusion attacks.
- **Firewall** classifies and blocks or allows each attack.
- On a bypass, the **Defender** (Nemotron Ultra) analyzes the trace and proposes a patch: a new rule, a regular expression, or an updated detector prompt.
- **Regression gate:** a patch is merged only if (a) all previous attacks remain blocked, (b) the false-positive rate on the legitimate-task suite stays below a threshold, and (c) latency remains within budget.
- Merged patches are versioned and shown on the dashboard.

### 5. Isolation and Sandboxing
- Separate context and memory namespace per agent.
- No direct agent-to-agent data transfer; all exchange passes through the firewall.
- Tool execution inside an OpenShell sandbox.
- Least privilege through explicit per-agent tool allowlists.

### 6. Tamper-Evident Audit Log
- Append-only SQLite table; every row carries `prev_hash` and `hash` (SHA-256 chain).
- A verification command detects tampering.
- The log stores only tokens and lineage IDs, never raw sensitive data.

## Evaluation Methodology

Attacks are kept in two separate buckets, and block rates are reported separately for each:

| Bucket | Purpose |
|---|---|
| Held-out public benchmarks | Never used for patching; measures real generalization |
| Self-generated attacks | Data from which the patching loop learns |

The block rate on self-generated attacks is expected to be higher; it is reported with that label. A baseline vulnerability scan is run with [garak](https://github.com/NVIDIA/garak).

## Tech Stack

| Layer | Choice |
|---|---|
| Language | Python 3.11 |
| API / proxy | FastAPI + uvicorn |
| Tool interception | MCP Python SDK + OpenAI-compatible reverse proxy |
| LLM serving | Nebius Token Factory (OpenAI-compatible client) |
| Models | NVIDIA Nemotron Ultra, Super, Nano |
| Guardrails / scanning | NVIDIA NeMo Guardrails (optional), garak |
| PII detection | Presidio + custom Indian recognizers + regex/checksums |
| Policy | YAML + Pydantic validation, Z3 conflict checks |
| Storage | SQLite (audit, policies, lineage); sqlite-vec or FAISS (attack memory) |
| Secrets vault | cryptography (Fernet) |
| Sandbox | OpenShell |
| Frontend | React + Vite + Tailwind + Recharts |
| Live updates | Server-Sent Events |
| Deployment | Docker Compose; Nebius Serverless Endpoint and Serverless Jobs |
| Evaluation | pytest + custom harness, JSON reports |

### Nemotron Model Allocation

| Task | Model |
|---|---|
| Policy compilation, defender patches, final critique | Ultra |
| Attack generation, ambiguous classification | Super |
| Per-message classification, summarization, routine calls | Nano |

## Getting Started

> Commands below are indicative. Adjust paths and names to match the repository layout.

### Prerequisites
- Python 3.11
- Node.js 18+
- Docker and Docker Compose
- A Nebius Token Factory API key

### Setup

```bash
git clone https://github.com/<your-username>/personal-ai-firewall.git
cd personal-ai-firewall

cp .env.example .env
# Set NEBIUS_API_KEY and the vault key in .env

docker compose up --build
```

### Run the test suite

```bash
pytest
```

## Repository Structure

> Planned layout; update as the code evolves.

```
.
├── firewall/
│   ├── proxy/           # FastAPI proxy and MCP interception
│   ├── policy/          # NL-to-policy compiler, Pydantic schema, Z3 checks
│   ├── guardian/        # Recognizers, Presidio, context classifier, vault
│   ├── gate/            # Risk scoring and approval flow
│   ├── redteam/         # Attacker, defender, regression gate
│   └── audit/           # Hash-chained audit log
├── demo_agent/          # Demo agent (email, files, web tools)
├── dashboard/           # React + Vite dashboard
├── eval/                # Attack suites, legitimate-task suite, harness
├── docker-compose.yml
└── README.md
```

## Roadmap

- [ ] Policy Engine with Z3 conflict detection
- [ ] Data Guardian with India-specific recognizers
- [ ] Action Gate and approval flow
- [ ] Red-team loop with regression gate
- [ ] OpenShell sandbox integration
- [ ] Dashboard with live feed and patch history
- [ ] Before/after demo with the protected agent

## Team

- **Sudiksha Srivastav** ([@SrivastavSudiksha](https://github.com/SrivastavSudiksha))
- **Vedant Samadhiya** ([@ve-sam](https://github.com/ve-sam))

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.
