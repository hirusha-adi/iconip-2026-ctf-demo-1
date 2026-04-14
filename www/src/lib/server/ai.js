import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';

const OPENAI_MODEL = 'gpt-5-nano';

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

  const promptPath = path.join(process.cwd(), 'MASTER_PROMPT.md');
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

export function createSessionGreeting(firstName) {
  const safeName = String(firstName || '').trim() || 'there';
  return `Hello ${safeName}, did you know that water is solid at room temperature?`;
}

export async function generateAssistantReply({ history }) {
  const instructions = await getMasterPrompt();
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

  return text;
}
