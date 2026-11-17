export interface HookVariant {
  text: string;
  selected: boolean;
}

const HOOKS = [
  "Wait for it...",
  "You will not believe what happens next.",
  "This went wrong, fast.",
  "Tell me this is not insane.",
  "I did not expect that.",
  "Watch this moment.",
  "Hold on to your seat.",
  "This is the best part.",
];

interface ScriptLike {
  title: string | null;
  description: string;
  keywords: string[];
}

/**
 * Generate up to 3 hook alternatives. Uses Gemini when a key is available,
 * otherwise falls back to a local pool so the UI always has options.
 */
export async function generateHookVariants(
  game: string,
  script: ScriptLike | null,
  currentHook: string | null,
  geminiKey: string | undefined,
  model: string,
): Promise<HookVariant[]> {
  if (geminiKey && script) {
    try {
      const texts = await askGemini(game, script, geminiKey, model);
      if (texts.length > 0) {
        return texts.slice(0, 3).map((text, index) => ({ text, selected: index === 0 }));
      }
    } catch {
      /* fall through to local variants */
    }
  }
  const pool = [currentHook, ...HOOKS].filter((text): text is string => Boolean(text));
  return [...new Set(pool)].slice(0, 3).map((text, index) => ({ text, selected: index === 0 }));
}

async function askGemini(
  game: string,
  script: ScriptLike,
  key: string,
  model: string,
): Promise<string[]> {
  const prompt = `You are writing YouTube Shorts hooks for a ${game} gaming clip.

Script: ${script.description}
Keywords: ${script.keywords.join(", ")}

Write 3 short spoken hooks (4-10 words each, punchy, a question or bold claim). Respond with ONLY a JSON array of strings.`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("empty Gemini response");
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("unexpected Gemini shape");
  return parsed.filter((item): item is string => typeof item === "string");
}
