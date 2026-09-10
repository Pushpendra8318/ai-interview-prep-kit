import type { ZodType } from 'zod';
import type { LLMProvider } from './types.js';

function extractJson(raw: string): unknown {
  let text = raw.trim();
  // Models occasionally wrap JSON in a markdown fence despite JSON-mode; strip it defensively.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) text = fenced[1].trim();
  return JSON.parse(text);
}

/**
 * Runs a prompt through the LLM and validates the result against a Zod
 * schema. If parsing/validation fails, re-asks the model once per remaining
 * attempt with the concrete validation error appended, rather than silently
 * accepting or saving invalid output (brief §16 / §30).
 */
export async function generateValidated<T>(
  provider: LLMProvider,
  buildPrompt: (repairNote?: string) => string,
  schema: ZodType<T>,
  maxAttempts = 2,
): Promise<T> {
  let lastError = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const repairNote =
      attempt === 1
        ? undefined
        : `Your previous response was invalid: ${lastError}. Return corrected JSON only, matching the requested shape exactly - no markdown, no commentary.`;
    const prompt = buildPrompt(repairNote);
    const raw = await provider.generateJson({ prompt });

    let parsed: unknown;
    try {
      parsed = extractJson(raw);
    } catch (error) {
      lastError = `response was not valid JSON (${(error as Error).message})`;
      continue;
    }

    const result = schema.safeParse(parsed);
    if (result.success) return result.data;

    lastError = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
  }

  throw new Error(
    `LLM output failed schema validation after ${maxAttempts} attempts: ${lastError}`,
  );
}
