# Security

This document describes the security model for **Architecture Drift Copilot**: how sensitive data is handled, what may reach the LLM, and the guarantees provided in each operating mode.

## Security Principles

1. **Whitelist, not blocklist.** The LLM receives only a small, explicitly enumerated set of non-sensitive fields. Anything not on the whitelist is never sent — this is enforcement by construction, not after-the-fact redaction.
2. **Redact at ingestion.** Sensitive values are stripped as data enters the application, before it reaches application state, the database, logs, or any report.
3. **No secret persistence.** SQLite stores only redacted findings and run metadata. Generated reports (HTML/JSON/PDF) are produced on demand and never stored.
4. **Read-only AWS.** Only `describe*` / `list*` style APIs are used. The app never creates, modifies, or deletes infrastructure.
5. **Safe by default.** Mock mode performs no external calls at all, so the demo can never leak credentials or hard-fail.

## Operating Modes and the Security Boundary

| | Mock Mode (`DEMO_MODE=true`) | Live Mode (`DEMO_MODE=false`) |
|---|---|---|
| AWS API calls | None | Read-only (`describe*` / `list*`) |
| LLM / Anthropic calls | None | Only with `ANTHROPIC_API_KEY`, whitelisted input only |
| Terraform CLI | None | `terraform show -json` (read-only) |
| Data source | Mock files only | Real inputs, auto mock-inventory fallback |

Mock mode is fully self-contained: it reads only `backend/data/mock/` and `examples/`, makes no network requests, and exposes the complete feature set with deterministic reasoning.

## Threat Model

**Assets to protect**

- AWS credentials and access keys
- Terraform state (may contain secrets)
- Database connection strings
- API keys and tokens
- Private keys and certificates

**Primary attack vectors**

1. Prompt injection / sensitive data leaking to the LLM
2. Accidental logging of secrets
3. Database exposure of sensitive values
4. Reports leaking secrets

## Control 1 — Ingestion-Time Redaction

The TerraformStateAgent (and any source-reading agent) redacts before data enters memory:

- **Field-name detection:** fields named like `password`, `secret`, `token`, `key`, `access_key`, `private_key`, `connection_string`, etc.
- **Pattern detection:** values shaped like access keys, bearer tokens, private-key PEM blocks, and connection strings.
- **Terraform-marked sensitive fields:** values flagged `sensitive` in Terraform state.

Redacted values are replaced with a placeholder and the resource is flagged `sensitiveRedacted: true`. Raw secret values never enter application state, the database, logs, or reports.

## Control 2 — LLM Input Whitelist (Critical)

The **ReasoningAgent is the only component that interacts with the LLM**, and it accepts only a pre-defined whitelisted finding object. Whitelist enforcement is validated at runtime; any non-whitelisted field is dropped/rejected before the request is built.

### The whitelisted finding object — the ONLY fields sent to the LLM

```ts
interface WhitelistedFinding {
  findingId: string;
  driftType: DriftType;
  resourceType: ResourceType;
  provider: Provider;
  region: string;
  logicalName: string;            // logical name only — never ARNs or physical IDs
  expected: WhitelistedAttributes;
  observed: WhitelistedAttributes;
  diffSummary: string;            // pre-computed, already redacted
}

interface WhitelistedAttributes {
  type?: string;
  region?: string;
  cidrBlocks?: string[];
  ports?: number[];
  protocol?: string;
  instanceType?: string;
  availabilityZones?: string[];
  tagKeys?: string[];             // KEYS ONLY — never tag values
  count?: number;
  flags?: Record<string, boolean>;
}
```

### Never sent to the LLM

- ARNs, account IDs, physical resource IDs
- AWS credentials, API keys, secrets
- Connection strings, passwords, private keys
- Raw Terraform state or full attribute blobs
- **Tag values** (only tag keys may be sent)

## Control 3 — No Secret Persistence

- SQLite stores only redacted findings, normalized non-sensitive attributes, and run metadata.
- Reports (HTML / JSON / PDF) are generated on the fly per request and are **not** stored server-side.
- No caching layer retains sensitive data.

## Control 4 — Read-Only AWS

- Only `describe*` / `list*` APIs for EC2, VPC, ELBv2, IAM where practical.
- No create/modify/delete operations are ever issued.
- When no credentials are present, the app automatically falls back to `examples/aws-mock-inventory.json` so the demo never fails.

## Compliance Score (reference)

Drift detection feeds a deterministic compliance score:

```
score = max(0, min(100, 100 + Σ(weight per drift)))

Default weights:
  critical: -25
  high:     -10
  medium:    -4
  low:       -1
  info:       0
```

## Reporting a Vulnerability

This is a hackathon/demo project. If you find a security issue, please open an issue describing the problem and reproduction steps (do not include real secrets in the report).
