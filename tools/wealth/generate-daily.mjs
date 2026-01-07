const root = process.cwd();
const dryRun = process.argv.includes("--dry-run");
const maxRetries = dryRun ? 0 : 2;
const cooldownDays = 45;
const FALLBACK_KEYWORDS = [
  "预算",
  "复利",
  "通胀",
  "风险",
  "储蓄"
];

const DIFFICULTY_LABELS = {
  1: "入门",
  2: "基础",
  3: "进阶",
  4: "高级",
  5: "专家"
};

// --- Prompts & Personas ---

const PERSONA = `You are a world-class financial educator and wealth manager (a fusion of Ray Dalio, Morgan Housel, and Richard Feynman). Your goal is to produce deep, insightful, and actionable financial content that respects the reader's intelligence. You despise generic advice. You love mental models, first principles, and historical context.`;

function buildBlueprintPrompt(candidate) {
  const related = candidate.related.join(", ") || "None";
  return `Design a high-quality daily financial lesson blueprint on: "${candidate.title}".

Context:
- Level: ${candidate.level || "General"}
- Category: ${candidate.category || "Finance"}
- Related Topics: ${related}

Your Task:
Create a structural blueprint for a "Mini-Blog Post" style lesson.
Return strict JSON with the following fields. Do not include any markdown formatting or comments in the JSON values that might break parsing:
1. "hook": A surprising analogy, historical anecdote, or counter-intuitive fact to grab attention immediately. (e.g., "Compound interest isn't math; it's biology.")
2. "core_concept": The technical definition explained simply using First Principles.
3. "why_it_matters": The urgent relevance to personal wealth *right now*. Why should the reader care today?
4. "key_insights": 3 distinct, non-obvious insights or "Mental Models". Avoid cliches. (e.g., instead of "Diversify", use "Diversification is admitting you don't know the future".)
5. "actionable_practice": 3 specific micro-actions or thought experiments. (e.g., "Calculate your X", "Check your Y", "Simulate Z").
6. "shadow_side": When does this concept fail? What are the hidden risks or psychological traps?
7. "references": 2-3 authoritative sources (books, papers, reputable sites) with URLs.

Output JSON only.`;
}

function buildDraftPrompt(candidate, blueprint) {
  return `You are the Author. Write the full English lesson content based on this Blueprint.

Blueprint:
${JSON.stringify(blueprint, null, 2)}

Requirements:
- Return strict JSON with fields: "topic", "summary", "key_points", "practice", "risk_notes", "sources".
- **topic**: String (English).
- **summary**: String (English). This is the core "Blog Post". Combine the Hook, Core Concept, and Why It Matters into a cohesive, engaging narrative (300-450 words). Use Markdown formatting (bolding key terms).
- **key_points**: Array of 3-4 strings (English). Each string is a "Mental Model" or insight.
- **practice**: Array of 3 objects. Each object has "title" (string) and "steps" (Array of strings). All in English.
- **risk_notes**: String (English).
- **sources**: Array of objects { title: string, url }.

Tone: Professional yet accessible, authoritative, data-driven.
Output JSON only.`;
}

function buildCritiquePrompt(draft) {
  return `You are the Ruthless Editor. Critique this financial lesson draft.

Draft:
${JSON.stringify(draft, null, 2)}

Identify 3 specific weaknesses:
1. Is the "summary" too dry, generic, or short? Does it lack a strong narrative voice?
2. Are the "key_points" trivial? (e.g., "Save money is good" vs "Savings rate matters more than investment return").
3. Is the "practice" actionable?

Return strict JSON: { "critique": "string", "score": number (0-10) }`;
}

function buildRevisePrompt(draft, critique) {
  return `You are the Author. Revise the draft to address the Editor's critique. Make it World-Class.

Critique: "${critique.critique}"
Score: ${critique.score}/10

Original Draft:
${JSON.stringify(draft, null, 2)}

Instructions:
- If the score is < 9, rewrite the weak sections significantly.
- Ensure the "summary" is a compelling read (Mini-Blog).
- Ensure "key_points" are deep insights.
- Keep the JSON structure exactly the same.

Return strict JSON only.`;
}

// --- Helper Functions ---

function mapDifficultyLabel(value) {
  if (typeof value !== "number") return "";
  const rounded = Math.max(1, Math.min(5, Math.round(value)));
  return DIFFICULTY_LABELS[rounded] || "";
}

function splitSteps(text) {
  if (!text) return [];
  return text
    .split(/\r?\n+/)
    .map((line) => line.replace(/^\s*(?:\d+\.|[-*\u2022])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

function normalizePractice(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => {
    if (typeof item === "string") {
      return { title: item, steps: [] };
    }
    return {
      title: item.title || "",
      steps: Array.isArray(item.steps) ? item.steps : splitSteps(item.steps || "")
    };
  });
}

function normalizeSources(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(entry => ({
    title: entry.title || "Source",
    url: entry.url
  })).slice(0, 6);
}

function daysBetween(dateA, dateB) {
  const diff = new Date(dateA).getTime() - new Date(dateB).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function flattenTopics(levels) {
  const items = [];
  for (const level of levels) {
    if (!level.categories) continue;
    for (const cat of level.categories) {
      if (!cat.topics) continue;
      for (const topic of cat.topics) {
        items.push({
          id: topic.topic, // Use topic name as ID if missing
          title: topic.topic,
          level: level.level,
          category: cat.category,
          difficulty: cat.difficulty,
          related: topic.related_topics || [],
          order: (level.level.match(/\d+/) || [0])[0] * 1000 + (cat.recommended_order || 0) * 100 + (topic.order || 0)
        });
      }
    }
  }
  // Sort by calculated order to ensure strict sequence
  items.sort((a, b) => a.order - b.order);
  return items;
}

function summarizeHistory(history) {
  const map = new Map();
  history.forEach((entry) => {
    if (entry.meta && entry.meta.id) {
      map.set(entry.meta.id, entry.date);
    }
  });
  return map;
}

function scoreCandidate(candidate, history, summary) {
  const todayStr = today();
  const lastUsed = summary.get(candidate.id);
  const progressScore = lastUsed ? 0.3 : 1;
  const recent = history.slice(0, 7);
  const categoryCount = recent.filter((entry) => entry.meta?.category === candidate.category).length;
  const coverageScore = 1 - Math.min(categoryCount / 7, 1);
  const lastPair = history.slice(0, 2).map((entry) => entry.meta?.related || []);
  const recentRelated = new Set(lastPair.flat());
  const relationScore = candidate.related && candidate.related.some((item) => recentRelated.has(item)) ? 1 : 0.4;
  const lastCategory = history[0]?.meta?.category;
  const diversityScore = lastCategory && lastCategory !== candidate.category ? 1 : 0.4;

  let cooldownPenalty = 0;
  if (lastUsed) {
    const days = daysBetween(todayStr, lastUsed);
    if (days < cooldownDays) cooldownPenalty = -5;
  }

  const difficultyGap = Math.abs((history[0]?.meta?.difficulty ?? candidate.difficulty) - candidate.difficulty);
  const difficultyPenalty = difficultyGap > 1 ? -2 : 0;

  const total = progressScore * 0.5 + coverageScore * 0.2 + relationScore * 0.2 + diversityScore * 0.1 + cooldownPenalty + difficultyPenalty;
  return total;
}

function pickCandidate(candidates, history) {
  if (!candidates.length) return null;
  const summary = summarizeHistory(history);
  
  // Strict sequential order: Find the first candidate that hasn't been used
  for (const candidate of candidates) {
    if (!summary.has(candidate.id)) {
      return candidate;
    }
  }
  
  // If all used, fallback to the one used longest ago (FIFO)
  // Sort candidates by last used date (ascending)
  const usedCandidates = candidates.filter(c => summary.has(c.id));
  usedCandidates.sort((a, b) => {
    const dateA = new Date(summary.get(a.id));
    const dateB = new Date(summary.get(b.id));
    return dateA - dateB;
  });
  
  return usedCandidates[0] || candidates[0];
}

function fallbackCandidate(candidates) {
  for (const keyword of FALLBACK_KEYWORDS) {
    const found = candidates.find(c => c.title.includes(keyword));
    if (found) return found;
  }
  return candidates[0] || null;
}

async function callLLM(prompt) {
  const apiKey = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing LLM_API_KEY");
  const baseURL = process.env.LLM_BASE_URL || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
  const model = process.env.LLM_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-chat";
  
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: PERSONA },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function parseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/```json([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e2) {
        // Try to fix common JSON issues if simple parse fails
        console.warn("JSON parse failed, attempting loose parse...");
        // This is a very basic fallback, might need more robust solution
        throw e2;
      }
    }
    throw e;
  }
}

function coerceLesson(candidate, lesson, date) {
  const sources = normalizeSources(lesson.sources);
  const practice = normalizePractice(lesson.practice);
  
  return {
    id: crypto.randomUUID(),
    date,
    topic: lesson.topic || candidate.title,
    summary: lesson.summary || "",
    key_points: lesson.key_points || [],
    practice: practice,
    risk_notes: lesson.risk_notes || "",
    sources: sources,
    meta: {
      id: candidate.id,
      category: candidate.category,
      difficulty: candidate.difficulty,
      level: candidate.level,
      related: candidate.related || [],
      tags: [candidate.category, mapDifficultyLabel(candidate.difficulty)].filter(Boolean)
    }
  };
}

function cloneDegraded(entry, date) {
  return {
    ...entry,
    id: crypto.randomUUID(),
    date,
    meta: {
      ...entry.meta,
      recycled: true
    }
  };
}

async function generateLesson(candidate, history) {
  console.log(`Generating lesson for: ${candidate.title}`);
  
  // 1. Blueprint
  const blueprintPrompt = buildBlueprintPrompt(candidate);
  const blueprintRaw = await callLLM(blueprintPrompt);
  const blueprint = parseJSON(blueprintRaw);
  
  // 2. Draft
  const draftPrompt = buildDraftPrompt(candidate, blueprint);
  const draftRaw = await callLLM(draftPrompt);
  const draft = parseJSON(draftRaw);
  
  // 3. Critique
  const critiquePrompt = buildCritiquePrompt(draft);
  const critiqueRaw = await callLLM(critiquePrompt);
  const critique = parseJSON(critiqueRaw);
  
  // 4. Revise (if needed)
  let finalContent = draft;
  if (critique.score < 9) {
    console.log(`Critique score ${critique.score}, revising...`);
    const revisePrompt = buildRevisePrompt(draft, critique);
    const revisedRaw = await callLLM(revisePrompt);
    finalContent = parseJSON(revisedRaw);
  }
  
  return finalContent;
}

import {
  DAILY,
  DAILY_ARCH,
  readJSON,
  writeJSON,
  rollWindowAndArchive,
  today,
  loadDotEnv,
  backoff,
  sleep
} from "./util.mjs";
import crypto from "crypto";
import path from "path";

async function main() {
  loadDotEnv();
  
  // Load topics
  const topicsPath = path.join(root, "data", "ai_wealth_topic.json");
  const topicsRaw = await readJSON(topicsPath, []);
  const candidates = flattenTopics(topicsRaw);
  
  // Load history
  const history = await readJSON(DAILY, []);
  
  // Check if already generated for today
  const todayStr = today();
  if (history.length > 0 && history[0].date === todayStr && !dryRun) {
    console.log("Today's lesson already exists.");
    return;
  }
  
  // Pick candidate
  const candidate = pickCandidate(candidates, history);
  if (!candidate) {
    console.error("No suitable candidate found.");
    process.exit(1);
  }
  
  // Generate
  let lesson;
  let attempts = 0;
  
  while (attempts <= maxRetries) {
    try {
      const content = await generateLesson(candidate, history);
      lesson = coerceLesson(candidate, content, todayStr);
      break;
    } catch (error) {
      attempts++;
      console.error(`Generation failed (Attempt ${attempts}/${maxRetries + 1}):`, error.message);
      
      if (attempts > maxRetries) {
        process.exit(1);
      }
      
      const delay = backoff(attempts - 1);
      console.log(`Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  
  if (!lesson) process.exit(1);
  
  // Update history
  const newHistory = [lesson, ...history];
  const kept = await rollWindowAndArchive(newHistory, 60, DAILY_ARCH);
  
  if (!dryRun) {
    await writeJSON(DAILY, kept);
    console.log(`Generated lesson: ${lesson.topic}`);
  } else {
    console.log("Dry run complete. Lesson not saved.");
    console.log(JSON.stringify(lesson, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
