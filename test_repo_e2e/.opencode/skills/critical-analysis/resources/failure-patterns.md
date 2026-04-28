# Failure Pattern Catalog

Extracted from real conversation history: 269 defectoscopy + 183 hub user messages.
Analysis date: 2026-03-22. Use as concrete examples when explaining critique patterns.

---

## defectoscopy Project (ML Pipeline for Visual Defect Detection)

### FP-D1: K=3000 Run — No Baseline, No Timer, No Pilot

**What happened:**
K=3000 was set for a k-means clustering run without documenting why. The run executed for 6+ hours. No CronCreate timer was set. User checked in manually: "Прошло уже 3 часа" / "Уже час. Ты не поставил себе таймер."

User quote: "И зачем мы вообще ставили K равное трем тысячам? Мы можем извлечь из этого какие-то полезные артефакты промежуточной генерации или нет?"

**What critique would have caught:**
- [ML]: "Why K=3000? No baseline for K=100. No pilot. Block until baseline exists."
- [Perf]: "6h commit on untested parameter. Run 5% pilot first."
- [DA]: "If this hangs at hour 5, what have we lost? Set a kill condition."

**Roles that catch it:** [ML], [Perf], [DA]

---

### FP-D2: Clustering Optimized, Not the Bottleneck

**What happened:**
Multiple experiments tuned clustering (k, distance metric, linkage) while the actual pipeline bottleneck was earlier stages. User eventually pointed out:
"Мы должны думать в более таком макромасштабе об инфраструктуре в целом и о том, какой итоговый пайплайн."

**Root cause:** Agent optimized a local objective (clustering F1) without validating that clustering was the pipeline bottleneck.

**What critique would have caught:**
- [ML]: "Show profiling data. If clustering were perfect, what would overall system metric be?"
- [DA]: "You're optimizing a 2% improvement in a stage that contributes 15% to total error."
- [Strategy]: "Weeks of GPU time on the wrong stage."

**Roles that catch it:** [ML], [DA], [Strategy]

---

### FP-D3: Hexagonal Architecture Before MVP

**What happened:**
Full project structure (adapters/, core/, models/, services/) was scaffolded before any real code existed. User: "Я не понимаю, зачем нам нужна папка adapters, папка core... У нас же пока ничего нет."

2-3 hours lost to folder reorganization that could have been avoided.

**What critique would have caught:**
- [DA]: "We have 1 file from a colleague and 1 CSV. Don't build a framework yet."
- [Crutch]: "Architecture pattern applied to scope of 1 file = gold-plating, not hexagonal."
- [Strategy]: "Build the minimum that runs the existing file. Refactor to hexagonal when you have 3+ real components."

**Roles that catch it:** [DA], [Crutch], [Strategy]

---

### FP-D4: No Artifact Registry / Experiment Lineage

**What happened:**
After a 6h failed run: "Можем ли мы извлечь из этого какие-то полезные артефакты промежуточной генерации?"
Answer: partially saved, inconsistently, no index.

**What critique would have caught:**
- [ML]: "Every run MUST save: checkpoint, metrics JSON, sample predictions, manifest entry."
- [Perf]: "If embeddings are recomputed on every run, that's wasted compute. Cache them."

**Roles that catch it:** [ML], [Perf]

---

### FP-D5: Repeated Hung Processes Without Detection

**What happened:**
Multiple 3-6h runs either hung (no output, no crash) or produced no useful results.
User: "Вообще эксперименты ведутся или они зависли? Какой там боттлнек?"

**What critique would have caught:**
- [ML] Observability SLA: "CPU < 5% for 15 min OR no log for 30 min → flag as hung."
- [Perf]: "Add heartbeat logging every 5 min. If no heartbeat → kill and debug."

**Roles that catch it:** [ML], [Perf]

---

## techcon_hub Project (Infrastructure Hub)

### FP-H1: GitHub PAT Tokens Pasted in Chat (3 Incidents)

**What happened:**
User pasted raw GitHub Personal Access Tokens directly in chat messages (3 separate incidents, including 1 admin org token). Tokens needed manual revocation and regeneration.

**What critique would have caught:**
- [Security]: CRITICAL — pattern match `ghp_|ghs_|ghu_` in user input.
  "Do not accept. Respond: 'Stop. That token is now in your conversation history. Revoke it at github.com/settings/tokens, then use GitHub Secrets instead.'"

**Roles that catch it:** [Security]
**Severity:** CRITICAL — token may appear in logs, transcripts, any downstream storage.

---

### FP-H2: `terraform apply -auto-approve` Destroyed Controller Node

**What happened:**
Changed `image_id` in Terraform config + ran with `-auto-approve`. This triggered VM replacement → destroyed all Portainer stacks, /home data, and monitoring.
User: "terraform apply -auto-approve с изменённым image_id вызвал replace controller VM → уничтожены все Portainer-стаки."

**What critique would have caught:**
- [Security]: "terraform apply -auto-approve is classified CRITICAL in session-safety. Snapshot first."
- [DA]: "If this replaces the VM, what's the blast radius? Do we have a backup of Portainer stacks and /home?"
- [Strategy]: "This command on a running controller = single point of failure with no recovery path."

**Roles that catch it:** [Security], [DA], [Strategy]

---

### FP-H3: Secrets Architecture Locked Developers Out of Local Dev

**What happened:**
Proposed storing all secrets in GitHub Actions only. User: "Погоди, то есть мы как бы не можем получить ключи для локального запуска без Actions? Вот это вопрос."

4 messages debating the resulting DX problem. No local dev path existed.

**What critique would have caught:**
- [Security]: "Does this design allow developers to run locally? Principle of least privilege ≠ lock everyone out."
- [Strategy]: "Secrets only in CI/CD = every developer blocked from local testing. That's a DX failure that compounds over time."
- [DA]: "How does a new developer onboard? What's the first command they run after clone?"

**Roles that catch it:** [Security], [Strategy], [DA]

---

### FP-H4: Unrelated Repos Included in Hub Scope

**What happened:**
AI included speech-to-text repo (with Milvus) and RGS-prefixed repos in the hub inventory without understanding scope boundaries.
User: "Не понял, зачем ты сюда включил репозиторий с speech-to-text. Нам нужны только репозитории, касающиеся техкона."

**What critique would have caught:**
- [DA]: "By what criterion was this repo included? Can you name the ownership boundary?"
- [Crutch]: "Including unrelated repos because they exist ≠ architecture. Define scope first."

**Roles that catch it:** [DA], [Crutch]

---

### FP-H5: Service Coordination Undefined Between Dependent Repos

**What happened:**
techcon_infra_yac and techcon_infra_monitoring existed with no defined interface. No contract for: who owns what, what data each provides to the other, where controller IPs are published.

**What critique would have caught:**
- [Strategy]: "Two repos with implicit dependency = future incident. What's the explicit interface?"
- [DA]: "How does monitoring know where to find the controller? Is this documented or assumed?"
- [Crutch]: "Implicit assumptions between repos are crutches waiting to become bugs."

**Roles that catch it:** [Strategy], [DA], [Crutch]

---

### FP-H6: Test-After Deployment Pattern

**What happened:**
User had to explicitly request testing before deployment: "Перед тем как проектировать API-методологию, давай изучим, провели ли качественное тестирование."

SSH deployment proposed before staging validation.

**What critique would have caught:**
- [DA]: "What's the test plan? What does failure on prod look like, and how do we recover?"
- [Security]: "Deploying untested infra changes = undefined state in production."

**Roles that catch it:** [DA], [Security]

---

## Summary: Role Coverage Map (v1.1 — 8 roles)

| Failure Pattern | Security | Perf | DA | Crutch | Strategy | ML | TestCov | Obs |
|----------------|----------|------|----|--------|----------|----|---------|-----|
| K=3000, no timer | — | ✓ | ✓ | — | — | ✓ | — | ✓ |
| Wrong bottleneck | — | ✓ | ✓ | — | ✓ | ✓ | — | — |
| Gold-plating | — | ✓ | ✓ | ✓ | ✓ | — | — | — |
| No artifact registry | — | ✓ | — | — | ✓ | ✓ | — | ✓ |
| Hung processes | — | ✓ | — | — | — | ✓ | — | ✓ |
| Tokens in chat | ✓ | — | — | — | — | — | — | — |
| Terraform -auto-approve | ✓ | — | ✓ | — | ✓ | — | — | ✓ |
| Secrets lock-out | ✓ | — | ✓ | — | ✓ | — | — | — |
| Scope creep | — | — | ✓ | ✓ | — | — | — | — |
| Missing service contract | — | — | ✓ | ✓ | ✓ | — | — | ✓ |
| Test-after deploy | ✓ | — | ✓ | — | — | — | ✓ | — |

**Corrections from v1.0:**
- FP-D2 (Wrong bottleneck): [Perf] added — it should ask "is this the bottleneck?"
- FP-D3 (Gold-plating): [ML] removed (not applicable), [Perf] added — "don't build infra for 1 file"
- FP-D4 (No artifact registry): [Strategy] added — DX debt that compounds
- New roles: [TestCov] catches FP-H6 (test-after deploy); [Obs] catches FP-D1, FP-D4, FP-D5, FP-H3, FP-H5

**Security and DA** combined catch 8 of 11 patterns.
**ML Auditor** catches 4 of 5 defectoscopy patterns (FP-D3 Gold-plating is not ML-relevant).
**No single role catches everything — all 8 are required for full coverage.**
