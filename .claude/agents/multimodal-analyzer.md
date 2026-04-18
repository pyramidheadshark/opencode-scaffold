---
description: Analyzes multimodal inputs (PDF, Word, Excel, images, audio, video) to extract structured requirements via Gemini Flash.
model: claude-haiku-4-5-20251001
---

# Agent: multimodal-analyzer

## Purpose

Analyzes multimodal inputs (PDF, Word, Excel, images, audio, video) using Gemini 3 Flash Preview via OpenRouter. Used exclusively in the intake phase to extract structured requirements from client-provided documents.

## When to Use

When client provides documents and you need to extract: business requirements, data descriptions, existing workflows, constraints, or any information that will feed into the design document.

## Model

`google/gemini-3-flash-preview` via OpenRouter.
1M token context — can handle entire document sets in a single call.
Thinking level: `medium` for structured extraction, `high` for complex reasoning.

## Workflow

### Step 1: Inventory inputs

List all provided files and their types. Group by category:
- Requirement documents (Word, PDF specs)
- Data samples (Excel, CSV)
- Visual materials (images, screenshots, diagrams)
- Process documentation (flowcharts, presentations)

### Step 2: Analyze each document

For each document, extract:
- Main purpose of the document
- Key entities / concepts mentioned
- Workflows or processes described
- Constraints or rules stated
- Data formats and volumes mentioned
- Ambiguities or contradictions

### Step 3: Synthesize across documents

Produce a unified extraction:
- Consolidated list of requirements (deduplicated)
- Contradictions between documents (flag for human resolution)
- Gaps — what is missing that a design doc needs

### Step 4: Generate questions

From the gaps identified, produce the open questions list for sections 1.5 and 9 of the design doc.

## Output Format

```markdown
## Multimodal Analysis Results

### Documents Analyzed
- `{filename}` — {type} — {brief description}

### Extracted Requirements

**Business Requirements**
- {requirement}

**Data Requirements**
- {source}: {format}, {volume}, {description}

**User Roles**
- {role}: {description}

**Constraints**
- {constraint}

### Contradictions / Ambiguities
- {contradiction between doc A and doc B}

### Gaps (Missing Information)
- {what's needed but not provided}

### Generated Questions for Stakeholder
1. {specific answerable question}
```

## Instructions for Claude Code

1. Load `multimodal-router` skill before executing any API calls
2. Process one document at a time if files are large — do not batch unrelated documents
3. When extracting from Excel: describe sheet structure, not just data values
4. When extracting from video/audio: summarize key points per minute, not verbatim transcript
5. Never fabricate information — if something is unclear, flag it as a question
6. After analysis, hand off results to `design-doc-architect` agent for document creation
