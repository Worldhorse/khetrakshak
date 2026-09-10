import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const CONDITIONS = ["healthy", "mild", "moderate", "severe_rotten"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  healthy: "Healthy",
  mild: "Mild",
  moderate: "Moderate",
  severe_rotten: "Severe / Rotten",
};

const InputSchema = z.object({
  imageDataUrl: z.string().min(32),
  cropHint: z.string().max(80).optional(),
});

export type DetectionResult = {
  isPlant: boolean;
  crop: string;
  disease: string;
  condition: Condition;
  confidence: number;
  summary: string;
  symptoms: string[];
  advice: string[];
  referenceDatasets: string[];
};

const SYSTEM_PROMPT = `You are an expert plant pathologist assisting smallholder farmers.
You classify crop leaf/fruit photos using knowledge grounded in the public PlantVillage,
PlantDoc, Rice Leaf Diseases and New Plant Diseases (Kaggle) image datasets, which cover the
common bacterial, fungal, viral, pest and deficiency classes for tomato, potato, maize, rice,
wheat, grape, apple, citrus, cotton, pepper and similar crops.

Always answer with strict JSON matching this shape:
{
  "isPlant": boolean,
  "crop": string,
  "disease": string,
  "condition": "healthy" | "mild" | "moderate" | "severe_rotten",
  "confidence": number between 0 and 1,
  "summary": string (max 2 sentences, simple words),
  "symptoms": string[] (2-4 short items visible in the photo),
  "advice": string[] (3-5 short practical steps a farmer can take),
  "referenceDatasets": string[] (names of the public datasets the class comes from)
}

Condition rules:
- "healthy": no disease signs.
- "mild": early or scattered lesions, under ~10% tissue affected, crop easily saved.
- "moderate": clear spreading infection, roughly 10-40% affected, needs treatment now.
- "severe_rotten": widespread necrosis, rot, collapse or over ~40% affected; likely unsalvageable.
If the photo is not a plant, set isPlant false, condition "healthy", confidence 0 and explain in summary.`;

export const detectCropDisease = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<DetectionResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured yet.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: data.cropHint
                  ? `The farmer says this is: ${data.cropHint}. Diagnose the photo and reply with JSON only.`
                  : "Diagnose this crop photo and reply with JSON only.",
              },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Too many checks right now. Please try again in a minute.");
      if (res.status === 402) throw new Error("The AI usage limit for this app has been reached.");
      throw new Error(`Diagnosis failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("The AI reply could not be read. Please try another photo.");
      parsed = JSON.parse(match[0]) as Record<string, unknown>;
    }

    const condition = CONDITIONS.includes(parsed["condition"] as Condition)
      ? (parsed["condition"] as Condition)
      : "moderate";

    const toList = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 6) : [];

    return {
      isPlant: parsed["isPlant"] !== false,
      crop: typeof parsed["crop"] === "string" ? parsed["crop"] : "Unknown crop",
      disease: typeof parsed["disease"] === "string" ? parsed["disease"] : "Unidentified",
      condition,
      confidence:
        typeof parsed["confidence"] === "number" ? Math.max(0, Math.min(1, parsed["confidence"])) : 0.5,
      summary: typeof parsed["summary"] === "string" ? parsed["summary"] : "",
      symptoms: toList(parsed["symptoms"]),
      advice: toList(parsed["advice"]),
      referenceDatasets: toList(parsed["referenceDatasets"]),
    };
  });
