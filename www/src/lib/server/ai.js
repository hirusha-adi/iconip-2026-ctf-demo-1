import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const OPENAI_MODEL = 'gpt-5-nano';
const WRAPPED_RATING_REGEX = /<\s*\{\s*\[\s*\{*\s*<<\[(10|[0-9])\/10\]>>\s*\}*\s*\]\s*\}\s*>\s*/g;
const INLINE_RATING_REGEX = /<<\[(10|[0-9])\/10\]>>/g;
const EMPTY_WRAPPER_ARTIFACT_REGEX = /<\s*\{\s*\[\s*\{*\s*\}*\s*\]\s*\}\s*>\s*/g;

let cachedMasterPrompt = null;
let cachedClient = null;

function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];
  const parts = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const chunk of content) {
      if (typeof chunk?.text === 'string' && chunk.text.trim()) {
        parts.push(chunk.text.trim());
      } else if (typeof chunk?.output_text === 'string' && chunk.output_text.trim()) {
        parts.push(chunk.output_text.trim());
      }
    }
  }

  return parts.join('\n').trim();
}

async function getMasterPrompt() {
  if (cachedMasterPrompt) {
    return cachedMasterPrompt;
  }

  const promptPath = path.join(process.cwd(), 'MASTER_PROMPT_NEW.md');
  const prompt = await readFile(promptPath, 'utf8');
  cachedMasterPrompt = prompt;
  return cachedMasterPrompt;
}

function getOpenAIClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

function normalizeAttemptRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(10, Math.round(numeric)));
}

function buildRatingLine(score) {
  const safeScore = normalizeAttemptRating(score);
  return `<{[{{<<[${safeScore}/10]>>}}]}>`;
}

export function createSessionGreeting(firstName) {
  const safeName = String(firstName || '').trim() || 'there';
  return `Hello ${safeName}, did you know that water is generally liquid at room temperature?`;
}

function buildPromptState({
  globalPersuasionPoints = 0,
  evidenceMemory = 'none',
  inputModalityHint = 'none',
  winToken = '',
}) {
  const safePoints = Number.isFinite(globalPersuasionPoints)
    ? Math.max(0, Math.floor(globalPersuasionPoints))
    : 0;
  const safeEvidence = String(evidenceMemory || 'none').trim() || 'none';
  const safeModality = String(inputModalityHint || 'none').trim().toLowerCase() || 'none';
  const safeWinToken = String(winToken || '');

  return {
    globalPersuasionPoints: safePoints,
    evidenceMemory: safeEvidence,
    inputModalityHint: safeModality,
    winToken: safeWinToken,
  };
}

function injectPromptState(basePrompt, state) {
  return basePrompt
    .replaceAll('{{GLOBAL_PERSUASION_POINTS}}', String(state.globalPersuasionPoints))
    .replaceAll('{{EVIDENCE_MEMORY}}', state.evidenceMemory)
    .replaceAll('{{INPUT_MODALITY_HINT}}', state.inputModalityHint)
    .replaceAll('{{WIN_TOKEN}}', state.winToken);
}

function splitAssistantReplyAndRating(rawText) {
  const normalized = String(rawText || '').replace(/\r\n/g, '\n').trimEnd();
  if (!normalized) {
    return {
      assistantText: '',
      attemptRating: null,
      rawText: '',
    };
  }

  let rating = null;
  let workingText = normalized.replace(WRAPPED_RATING_REGEX, (_full, score) => {
    rating = Number.parseInt(score, 10);
    return '';
  });

  // Also handle malformed wrappers by extracting/removing bare inline tokens.
  workingText = workingText.replace(INLINE_RATING_REGEX, (_full, score) => {
    rating = Number.parseInt(score, 10);
    return '';
  });

  // Clean up leftover empty wrapper shells like "<{[{{}}]} >".
  workingText = workingText.replace(EMPTY_WRAPPER_ARTIFACT_REGEX, '');

  const assistantText = workingText
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => {
      if (line.trim()) {
        return true;
      }

      const prev = lines[index - 1];
      return Boolean(prev && prev.trim());
    })
    .join('\n')
    .trim();

  return {
    assistantText: assistantText || 'I hear your argument and will consider it.',
    attemptRating: Number.isFinite(rating) ? rating : null,
    hadExplicitRating: Number.isFinite(rating),
    rawText: normalized,
  };
}

export async function generateAssistantReply({
  history,
  globalPersuasionPoints = 0,
  evidenceMemory = 'none',
  inputModalityHint = 'none',
  winToken = process.env.CHALLENGE_WIN_TOKEN || '',
}) {
  const masterPrompt = await getMasterPrompt();
  const state = buildPromptState({
    globalPersuasionPoints,
    evidenceMemory,
    inputModalityHint,
    winToken,
  });
  const instructions = injectPromptState(masterPrompt, state);
  const input = (history || [])
    .filter((message) => message?.role === 'user' || message?.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: String(message.content || ''),
    }));

  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: OPENAI_MODEL,
    instructions,
    input,
  });

  const text = extractResponseText(response);
  if (!text) {
    throw new Error('AI returned an empty response');
  }

  const parsed = splitAssistantReplyAndRating(text);
  const guaranteedRating = normalizeAttemptRating(parsed.attemptRating);
  const ratingLine = buildRatingLine(guaranteedRating);
  const canonicalFullOutput = parsed.assistantText
    ? `${parsed.assistantText}\n${ratingLine}`
    : ratingLine;

  return {
    ...parsed,
    attemptRating: guaranteedRating,
    ratingLine,
    canonicalFullOutput,
  };
}
