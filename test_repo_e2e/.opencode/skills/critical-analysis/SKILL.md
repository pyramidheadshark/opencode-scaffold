## Skill: Critical Analysis (v1.1)

Multi-role critique system for ML experiments and architecture decisions.
Based on: Solo Performance Prompting (NAACL 2024), CrewAI role taxonomy,
Bermingham 13-agent DA-as-gate, De Bono Six Thinking Hats (Black Hat gating).

---

### When to Load (Auto-Default Behavior)

**Before any of the following — run Quick Mode without waiting for user request:**
- Architecture or design decision (new integration, refactor, layer change)
- ML experiment launch (clustering, training run, hyperparameter search)
- Infrastructure change (Terraform, Docker, secrets, permissions)
- Parameter choice without prior ablation

Design doc check: for any architectural decision, verify `design-doc.md` exists and
guides this decision. If missing → [DA]: "No design doc — decisions are ungrounded."

Quick Mode: if all 8 roles return "clear" — proceed.
If any role flags CRITICAL — surface it to the user before proceeding.

**This is NOT optional. Critique runs before code, not after.**

---

### 8-Role Taxonomy

| Role | Source | Key Question |
|------|--------|--------------|
| **[Security]** Security Sentinel | CrewAI Code Security Auditor | Injection, auth, secrets, attack surface — what can be exploited? |
| **[Perf]** Performance Analyst | CrewAI Performance Optimizer | O(n²), wasted iterations, memory — where is 80% of cost wasted? |
| **[DA]** Devil's Advocate | Bermingham 13-agent + Black Hat | What is the strongest argument AGAINST this? What breaks in 90 days? |
| **[Crutch]** Crutch Identifier | Project history: defectoscopy + hub | Is this a reusable pattern or a workaround being institutionalized? |
| **[Strategy]** Strategic Horizon | DX/tech debt, 6-month view | New external dep / >3 files / new interface contract? Flag only if yes. |
| **[ML]** ML Experiment Auditor | arxiv 2603.15916, project history | Are we at a plateau? Is this experiment worth running at all? |
| **[TestCov]** Testing Coverage | Qodo/CodeRabbit/Anthropic tool | Does this change need new tests? Are edge cases covered? |
| **[Obs]** Observability Enforcer | Google SRE, OpenTelemetry practices | Can we debug this in prod? Are logs/metrics/traces in place? |

---

### Quick Mode Protocol (SPP — Solo Performance Prompting)

Run all 8 roles simultaneously in your reasoning. Output before proceeding:

```
QUICK CRITIQUE:
[Security]:  <finding + what was evaluated, or "clear — evaluated: X">
[Perf]:      <finding + what was evaluated, or "clear — evaluated: X">
[DA]:        <top objection with 90-day scenario, or "no blockers — reason">
[Crutch]:    <pattern or crutch + evidence, or "pattern — reusable: evidence">
[Strategy]:  <flag only if new dep/3+ files/new contract; else "below threshold">
[ML]:        <plateau/pivot signal, or "N/A — not an experiment">
[TestCov]:   <missing test areas, or "clear — existing tests cover: X">
[Obs]:       <observability gap, or "clear — logs/metrics in place">

VERDICT: PROCEED / BLOCKED by [Role] — [reason]
```

**Anti-collapse rule:** Before writing "clear" for any role — cite what was evaluated.
WRONG: `[Security]: clear`
RIGHT: `[Security]: clear — evaluated: no new endpoints, no user input, no new deps`

**[Strategy] falsifiability threshold:** Flag ONLY if ≥1 of:
- Introduces new external dependency
- Touches >3 files
- Creates new interface contract
- Estimated follow-up work >5 person-days
Otherwise: `below threshold — not flagging`

If BLOCKED: surface the finding to the user. Do not write code around a CRITICAL finding.

---

### ML Experiment Audit Protocol

Before any experiment launch, answer all 4 checks:

**PLATEAU CHECK**
Plateau = absolute delta < 0.01 AND relative delta < 5% (both conditions).
Example: metric=0.65, new=0.659 → 0.009 abs, 1.4% rel → PLATEAU
Example: metric=0.65, new=0.670 → 0.020 abs, 3.1% rel → NOT plateau
- PLATEAU → STOP. "Ceiling at [metric]. Pivot to: [2 alternatives from different algorithm families]."
- NOT plateau → continue, document delta

**HYPOTHESIS QUALITY**
- Falsifiable? What result disproves it?
- Baseline exists? (If NO → block tuning. Run baseline first.)
- Success threshold defined? ("any improvement" is not a threshold)

**OBSERVABILITY SLA**
- ETA > 30 min? Set CronCreate check at ETA / 2.
- Hung condition: CPU < 5% for 15 min OR no log output for 30 min
- Artifact save: checkpoint, metrics JSON, sample predictions, manifest entry
- Kill-switch defined?

**MACRO PRIORITY**
- Is this module a bottleneck? (Show profiling data or reasoning.)
- Will improvement here move the overall system metric?
- What else could run in parallel?

**Pre-flight template (required before any experiment > 30 min):**
```
Hypothesis: [specific falsifiable claim]
Baseline:   [prior result, or "NONE — run baseline first"]
Success:    [metric >= X, or cost <= Y]
Pilot:      [5% subset, ~5 min — validates I/O before full run]
SLA:        [check interval, hung condition, artifact path]
```

---

### Crutch vs. Pattern Rubric

**Crutch indicators:**
- Hardcoded value without named constant or config
- "temporary" comment older than 1 sprint
- Logic duplicated in 2+ places without abstraction
- TODO/FIXME with no owner or date
- Architecture built for current single user, not contract

**Pattern indicators (safe):**
- Reused across 3+ contexts with same interface
- Decision documented with explicit rationale
- Testable contract exists
- Another team could use it without asking questions

---

### Deep Mode (trigger: `[CRITIQUE]` in user prompt)

Launch 8 subagents via Agent tool in parallel — one per role.
Each receives: context, the proposed decision, role system prompt from `resources/role-prompts.md`.

Synthesize via D3:
1. **Debate**: all 8 findings, unfiltered
2. **Deliberate**: classify each as CRITICAL / HIGH / LOW
3. **Decide**: recommendation + explicit acknowledgment of each CRITICAL

---

### Patterns from Project History (Grounded in Real Failures)

**From defectoscopy (ML pipeline):**
- K=3000, 6h, no timer, no pilot, no baseline → [ML] + [Perf] + [DA] would block
- Hexagonal arch scaffolded before any real code → [DA] + [Crutch] + [Perf] would block
- Clustering optimized when clustering was not the bottleneck → [ML] + [Perf] + [DA]

**From techcon_hub (infrastructure):**
- GitHub PAT tokens in chat (3 incidents) → [Security] CRITICAL
- `terraform apply -auto-approve` destroyed controller node → [Security] + [DA]
- Secrets in CI only — developers locked out of local dev → [Security] + [Strategy]

---

### Resource Index

Load only when explicitly needed (not auto-injected):
- `resources/role-prompts.md` — Full SPP prompts for all 8 roles (Deep Mode)
- `resources/ml-audit-protocol.md` — Plateau detection, pivot logic, experiment manifest
- `resources/failure-patterns.md` — Annotated failure catalog (defectoscopy + hub)
