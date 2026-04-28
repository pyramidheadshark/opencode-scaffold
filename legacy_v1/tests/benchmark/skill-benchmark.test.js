'use strict';

const path = require('path');
const fs = require('fs');
const { matchSkills, loadSkillRules } = require('../../.claude/hooks/skill-activation-logic');

const RULES_PATH = path.resolve(__dirname, '../../.claude/skills/skill-rules.json');
const GOLDEN_PATH = path.resolve(__dirname, 'golden-prompts.json');

const PLAN_MODE_KEYWORDS = [
  'план', 'планир', 'запланир', 'спланируем', 'спланируй', 'давай спланируем',
  'многоступенчат', 'поэтапн', 'пошагов', 'составь план', 'разработай план',
  'рефакторинг', 'рефактор', 'перепиши', 'переработ',
  'архитектур', 'мигрир', 'интегрир', 'реализ', 'разработай',
  'фичу', 'фичи',
  'внедри', 'оптимизир', 'разверни',
  'planning', 'multi-step', 'multi-phase', 'step-by-step', "let's plan",
  'refactor', 'rewrite', 'migrate', 'migration', 'redesign', 'rollout', 'overhaul', 'sprint',
];

const QUESTION_PREFIXES = [
  'what', 'how', 'why', 'explain', 'show', 'describe', 'tell me', 'can you explain',
  'can ', 'could ', 'would ', 'should ', 'is it ', 'are there ', 'do we ',
  'что ', 'как ', 'почему', 'зачем', 'объясни', 'расскажи', 'покажи', 'в чём',
  'можешь ', 'можно ', 'а как ', 'а что ', 'скажи ', 'подскажи',
];

const SECURITY_PATTERNS = [
  'auth', 'login', 'password', 'token', 'secret',
  'db', 'database', 'query', 'session', 'credential',
  'api', 'endpoint', 'user', 'permission', 'role',
];

function detectPlanMode(prompt) {
  const lower = prompt.toLowerCase();
  const isQuestion = QUESTION_PREFIXES.some((q) => lower.startsWith(q));
  return !isQuestion && PLAN_MODE_KEYWORDS.some((kw) => lower.includes(kw));
}

function detectSecurity(changedFiles) {
  return changedFiles.some((f) =>
    SECURITY_PATTERNS.some((p) => f.toLowerCase().includes(p))
  );
}

function setsEqual(a, b) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

let rules;
let dataset;
let platformTriggeredSkills;

beforeAll(() => {
  rules = loadSkillRules(fs, RULES_PATH);
  if (!rules) throw new Error('Could not load skill-rules.json from fixture');
  dataset = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
  platformTriggeredSkills = new Set(
    (rules.rules || [])
      .filter(r => r.triggers && r.triggers.platform_trigger)
      .map(r => r.skill)
  );
});

describe('Golden dataset — per-case assertions', () => {
  test.each(
    (() => {
      const data = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, 'golden-prompts.json'), 'utf8')
      );
      return data.map((entry) => [entry.id, entry]);
    })()
  )('%s', (id, entry) => {
    const { prompt, changed_files, session_context, expected } = entry;
    const maxSkills = (rules.context_management || {}).max_skills_per_session || 3;
    const alreadyLoaded = (session_context || {}).alreadyLoadedSkills || [];

    const rawSkills = matchSkills(
      rules.rules || [],
      prompt,
      changed_files || [],
      maxSkills,
      alreadyLoaded
    );
    const actualSkills = rawSkills.filter(s => !platformTriggeredSkills.has(s));

    const actualPlanMode = detectPlanMode(prompt);
    const actualSecurity = detectSecurity(changed_files || []);

    expect(actualSkills.sort()).toEqual(expected.skills.slice().sort());
    expect(actualPlanMode).toBe(expected.plan_mode);
    expect(actualSecurity).toBe(expected.security_injection);
  });
});

describe('Benchmark summary — precision/recall/accuracy', () => {
  const PRECISION_THRESHOLD = 0.85;
  const RECALL_THRESHOLD = 0.80;

  test('skill activation precision >= 0.85 and recall >= 0.80', () => {
    const maxSkills = (rules.context_management || {}).max_skills_per_session || 3;

    let tp = 0, fp = 0, fn = 0;
    const failing = [];

    for (const entry of dataset) {
      const { prompt, changed_files, session_context, expected, id } = entry;
      const alreadyLoaded = (session_context || {}).alreadyLoadedSkills || [];

      const rawActual = matchSkills(
        rules.rules || [],
        prompt,
        changed_files || [],
        maxSkills,
        alreadyLoaded
      );
      const actual = rawActual.filter(s => !platformTriggeredSkills.has(s));

      const expectedSet = expected.skills;
      const actualSet = actual;

      const tpHere = actualSet.filter((s) => expectedSet.includes(s)).length;
      const fpHere = actualSet.filter((s) => !expectedSet.includes(s)).length;
      const fnHere = expectedSet.filter((s) => !actualSet.includes(s)).length;

      tp += tpHere;
      fp += fpHere;
      fn += fnHere;

      if (!setsEqual(actualSet.sort(), expectedSet.slice().sort())) {
        failing.push({ id, expected: expectedSet, actual: actualSet });
      }
    }

    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;

    console.log('\n=== Skill Activation Benchmark ===');
    console.log(`Skills precision: ${precision.toFixed(2)}  recall: ${recall.toFixed(2)}`);
    if (failing.length > 0) {
      console.log(`Failing cases (${failing.length}):`);
      for (const f of failing) {
        console.log(`  [${f.id}] expected: [${f.expected.join(', ')}]  actual: [${f.actual.join(', ')}]`);
      }
    } else {
      console.log('All cases matched expected output.');
    }

    expect(precision).toBeGreaterThanOrEqual(PRECISION_THRESHOLD);
    expect(recall).toBeGreaterThanOrEqual(RECALL_THRESHOLD);
  });

  test('plan mode detection accuracy >= 0.90', () => {
    let correct = 0;
    const failing = [];

    for (const entry of dataset) {
      const actual = detectPlanMode(entry.prompt);
      if (actual === entry.expected.plan_mode) {
        correct++;
      } else {
        failing.push({ id: entry.id, expected: entry.expected.plan_mode, actual });
      }
    }

    const accuracy = correct / dataset.length;
    console.log(`\nPlan mode accuracy: ${accuracy.toFixed(2)}`);
    if (failing.length > 0) {
      console.log(`Failing: ${failing.map((f) => `[${f.id}] expected=${f.expected} got=${f.actual}`).join(', ')}`);
    }

    expect(accuracy).toBeGreaterThanOrEqual(0.90);
  });

  test('security injection accuracy >= 0.95', () => {
    let correct = 0;
    const failing = [];

    for (const entry of dataset) {
      const actual = detectSecurity(entry.changed_files || []);
      if (actual === entry.expected.security_injection) {
        correct++;
      } else {
        failing.push({ id: entry.id, expected: entry.expected.security_injection, actual });
      }
    }

    const accuracy = correct / dataset.length;
    console.log(`Security injection accuracy: ${accuracy.toFixed(2)}`);
    if (failing.length > 0) {
      console.log(`Failing: ${failing.map((f) => `[${f.id}]`).join(', ')}`);
    }

    expect(accuracy).toBeGreaterThanOrEqual(0.95);
  });
});
