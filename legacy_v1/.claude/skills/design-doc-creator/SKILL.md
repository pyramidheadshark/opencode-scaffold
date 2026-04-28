# Design Doc Creator

## When to Load This Skill

Load when: starting a new project, creating or updating `design-doc.md`, translating client requirements into structured documentation, filling in the design document template.

## Purpose

This skill guides the creation of a complete design document. It is always the first deliverable of any project — before environment setup, before tests, before code.

## Document Structure (10 Sections)

The template lives at `templates/design-doc.md` in `claude-scaffold`.

| Section | Owner | When |
|---|---|---|
| 0. Quick Summary | Agent (from inputs) | Intake |
| 1. Business Context | Human + Agent | Intake → Iteration |
| 2. Users and Roles | Human + Agent | Intake → Iteration |
| 3. Input Data | Human | Intake |
| 4. Use Cases / Scenarios | Human + Agent | Iteration |
| 5. Non-Functional Requirements | Human + Agent | Iteration |
| 6. Technical Architecture | Agent | After 1–5 approved |
| 7. Test Plan | Agent | After 6 drafted |
| 8. Deployment Plan | Agent | After 6 drafted |
| 9. Open Technical Questions | Agent | Ongoing |
| 10. Changelog | Agent | Every update |

Sections 1–5 must be fully resolved before agent writes sections 6–9.

## Intake Phase Workflow

### Step 1: Collect all available inputs

Sources may include:
- Voice transcript / written description from human
- Client Excel checklist (use `multimodal-router` skill if needed)
- Existing partial documentation
- Uploaded PDF / Word files

### Step 2: Populate template

Fill every section. Mark unknown values as `TBD` — never leave blanks.
Mark resolved items as `Agreed`.

### Step 3: Generate open questions

Categorise as:
- **Business** — client/stakeholder must answer
- **Technical** — developer decides or researches

Keep questions specific and answerable. Not "what are the requirements?" but
"What is the maximum acceptable response latency for the chat endpoint — 2s, 5s, or unconstrained?"

### Step 4: Iterate

Re-run steps 2–3 with each batch of answers.
Stop when all **Business** questions in section 1.5 are resolved.
Technical questions may remain open during early development.

### Step 5: Finalize

- Change status header from `DRAFT` → `REVIEW`
- Create `dev/status.md` using the template
- Set active phase to "Phase 1: Design Document"
- Seed backlog with first 5 tasks from the design doc

## Quality Checklist Before Approval

- [ ] Every scenario in section 4 maps to a `.feature` file path
- [ ] Every NFR in section 5 has a measurable value or explicit `TBD`
- [ ] No vague requirements ("system should be responsive", "easy to use")
- [ ] Input data in section 3 has format, volume, and acquisition status
- [ ] Load numbers in section 2 have concrete estimates or `TBD`
- [ ] Stack choices in section 6 have rationale, not just names
- [ ] All known secrets are listed in section 6.5

## Updating an Existing Design Doc

When requirements change:
1. Update affected sections
2. Log the change in section 10 (Changelog)
3. Bump the version (patch for clarifications, minor for new scenarios, major for scope changes)
4. Update `dev/status.md` with the architectural decision if significant

Never delete old content — mark it as `[DEPRECATED]` with a date and replacement reference.
