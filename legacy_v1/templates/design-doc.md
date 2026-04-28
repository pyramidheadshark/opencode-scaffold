# Design Document: {Project Name}

> Status: DRAFT | REVIEW | APPROVED
> Version: 0.1.0
> Last updated: {YYYY-MM-DD}
> Authors: {name}, Claude Code

---

## 0. Quick Summary

| Field | Value |
|---|---|
| Project | {name} |
| Business goal | {one sentence} |
| Core problem | {one sentence} |
| Solution | {one sentence} |
| Stack | FastAPI + Docker Compose + {specifics} |
| Target deploy | Yandex Cloud / Docker Compose / K8s |

---

## 1. Business Context

### 1.1 Problem Statement

{Describe the current situation and the pain it causes. Be specific — what exactly is broken or missing?}

### 1.2 Business Goal

{What measurable outcome do we want? What does success look like in 3-6 months?}

### 1.3 Scope

**In scope:**
- {item}
- {item}

**Out of scope (explicitly):**
- {item}
- {item}

### 1.4 Key Decisions Already Made

| Decision | Choice | Rationale |
|---|---|---|
| {decision} | {choice} | {why} |

### 1.5 Open Business Questions

> These must be resolved before technical implementation begins.

- [ ] {question for stakeholder}
- [ ] {question for stakeholder}

---

## 2. Users and Roles

| # | Role | Description | Est. Count | Scenarios |
|---|---|---|---|---|
| 1 | {role} | {description} | {N} | #{scenario IDs} |

### Expected Load

| Metric | Value | Notes |
|---|---|---|
| Total users | {N} | |
| Peak concurrent | {N} | {note} |
| Avg requests/user/day | {N} | |

---

## 3. Input Data

| # | Source | Format | Volume | Description | Status |
|---|---|---|---|---|---|
| 1 | {name} | {format} | {volume} | {description} | {received/pending/?} |

---

## 4. Use Cases and Scenarios

For each scenario, a corresponding `.feature` file will be created in `tests/features/`.

### Scenario 1: {Name}

**Actor**: {role}
**Trigger**: {what initiates this}
**Preconditions**: {what must be true}

**Main flow**:
1. {step}
2. {step}
3. {step}

**Alternative flows**:
- {condition} → {what happens}

**Expected response format**: {text / JSON / HTML / file}
**Data sources**: {from section 3}
**Priority**: High / Medium / Low

---

## 5. Non-Functional Requirements

| # | Category | Requirement | Status | Notes |
|---|---|---|---|---|
| 1 | Performance | Response time < {N}ms (p95) | {TBD/Agreed} | |
| 2 | Performance | Peak load: {N} concurrent users | {TBD/Agreed} | |
| 3 | Availability | Uptime {N}% | {TBD/Agreed} | |
| 4 | Security | {requirement} | {TBD/Agreed} | |
| 5 | Data | {retention / privacy policy} | {TBD/Agreed} | |
| 6 | Scalability | K8s-ready from day one | Agreed | Docker Compose first, Helm chart prepared |

---

## 6. Technical Architecture

> This section is written by Claude Code after business sections are finalized.

### 6.1 Stack

```
Backend:    FastAPI {version}
Frontend:   HTMX + Jinja2 (if needed)
Database:   {PostgreSQL / SQLite / None}
Vector DB:  {Qdrant / pgvector / None} (if RAG needed)
LLM:        claude-sonnet-4-6 via Claude Code
Multimodal: google/gemini-3-flash-preview via OpenRouter
Deploy:     Docker Compose → YC VM (Packer + Terraform)
CI/CD:      GitHub Actions
```

### 6.2 Repository Structure

```
{project-name}/
├── src/
│   └── {project_name}/
│       ├── api/
│       │   ├── routers/
│       │   └── pages/         # HTMX routes (if needed)
│       ├── core/              # domain — zero framework imports
│       ├── services/
│       ├── adapters/
│       │   ├── llm/
│       │   ├── storage/
│       │   └── db/
│       └── models/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── features/
├── infra/
│   ├── packer/
│   └── terraform/
├── dev/
│   └── status.md
├── pyproject.toml
├── docker-compose.yml
├── Dockerfile
└── design-doc.md
```

### 6.3 Data Flow

```
{Describe main data flow — e.g., user request → router → service → adapter → LLM → response}
```

### 6.4 Integrations

| Integration | Method | Auth | Notes |
|---|---|---|---|
| OpenRouter / Gemini 3 Flash | HTTP REST | API Key | Multimodal only |
| {DB} | {ORM/driver} | {method} | |

### 6.5 Secrets and Configuration

All secrets via `.env` locally, GitHub Secrets in CI/CD.
Required keys listed in `.env.example`.
Validated at startup via `pydantic-settings`.

---

## 7. Test Plan

> Tests are written before implementation. Scenarios from section 4 map 1:1 to `.feature` files.

| Scenario | Feature File | Priority | Status |
|---|---|---|---|
| {scenario name} | `tests/features/{name}.feature` | High | Not started |

### Coverage Targets

- `core/`: 100%
- `services/`: ≥90%
- `api/`: ≥80%
- Overall: ≥80%

---

## 8. Deployment Plan

### 8.1 Environments

| Env | Infrastructure | Branch | Notes |
|---|---|---|---|
| local | Docker Compose | any | developer machine |
| staging | YC VM (Packer image) | `main` | manual deploy |
| production | YC VM or K8s | tagged release | {notes} |

### 8.2 CI/CD Pipeline (GitHub Actions)

1. `lint.yml` — ruff + mypy on every push
2. `test.yml` — pytest with coverage on PR
3. `build.yml` — Docker image build and push
4. `deploy.yml` — deploy to YC on tag

---

## 9. Open Technical Questions

> Logged here, resolved iteratively with Claude Code.

- [ ] {question}
- [ ] {question}

---

## 10. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | {date} | {name} | Initial draft |
