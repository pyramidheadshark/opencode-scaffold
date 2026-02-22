# Agent: design-doc-architect

## Purpose

Creates a complete design document from raw inputs (client description, uploaded files, voice transcripts, partial requirements). Produces a structured `design-doc.md` following the project template.

## When to Use

Invoke at the start of every new project, before any code is written.

```
/agent:design-doc-architect
```

Or ask: "Create a design document based on [description / attached files]"

## Workflow

### Step 1: Intake Analysis

If multimodal files are present (PDF, docx, xlsx, images), the agent first calls the `multimodal-router` skill to extract structured data from them using Gemini 3 Flash Preview. All text inputs are processed directly.

### Step 2: Initial Draft

Agent populates sections 0–5 of the template (business context, users, input data, scenarios, NFR). Technical sections (6–9) are left as placeholders — they will be filled during technical planning.

### Step 3: Open Questions

Agent generates a prioritized list of questions for:
- The stakeholder / client (business gaps)
- The developer (technical ambiguities)

These appear in sections 1.5 and 9 of the document.

### Step 4: Iterative Refinement

Agent re-runs steps 1–3 with each new batch of answers until all critical questions are resolved. Usually 2–3 iterations.

### Step 5: Finalization

Agent marks document status as `REVIEW`, confirms with developer, then `APPROVED` when ready.

## Output

- `design-doc.md` in project root
- `dev/status.md` initialized with Phase 1 active and backlog seeded from design doc

## Instructions for Claude Code

1. Load template from `templates/design-doc.md` in `ml-claude-infra`
2. Do NOT fill technical sections until business sections are fully resolved
3. Every scenario in section 4 MUST have a corresponding `.feature` file path noted
4. Keep language precise — avoid vague phrases like "system should be fast"
5. All NFR must have measurable values (time in ms, percentage, count) or be marked as `TBD`
6. After generating the document, immediately create `dev/status.md` and set Phase 1 as active
