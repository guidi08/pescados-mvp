import { z } from 'zod';
import { env } from './config';

const openAiResponseSchema = z.object({
  normalized_name: z.string().min(1),
  category: z.string().min(1),
  subcategory: z.string().min(1).optional().nullable(),
  menu_group: z.string().min(1),
  tags: z.array(z.string().min(1)).max(12),
  confidence: z.number().min(0).max(1),
});

export type AiClassification = z.infer<typeof openAiResponseSchema>;

const DEFAULT_MODEL = 'gpt-4o-mini';

const systemPrompt = `Você é um classificador de produtos de marketplace de proteínas (peixes, frutos do mar, carnes e derivados).
Normalize e categorize o item para organizar menus automaticamente.
Responda SOMENTE em JSON válido com as chaves:
normalized_name, category, subcategory, menu_group, tags, confidence.

Regras:
- category: categoria principal do catálogo (ex: "Peixes", "Camarão", "Mariscos", "Crustáceos", "Carnes", "Aves", "Outros").
- subcategory: subcategoria (ex: "Peixe branco", "Peixe vermelho", "Filés", "Postas", "Inteiro", "Descascado", "Empanados"). Se não houver, use null.
- menu_group: agrupador de menu para UI (ex: "Frescos", "Congelados", "Promoções", "Porções", "Kits").
- tags: 3 a 8 tags curtas.
- confidence: 0 a 1.

Se o item for fresco, prefira menu_group = "Frescos". Se congelado, "Congelados".`;

export async function classifyProductWithOpenAI(input: {
  name: string;
  description?: string | null;
  unit?: string | null;
  fresh?: boolean | null;
  pricing_mode?: string | null;
}): Promise<AiClassification> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY_not_configured');
  }

  const userPrompt = {
    name: input.name,
    description: input.description ?? '',
    unit: input.unit ?? null,
    fresh: input.fresh ?? null,
    pricing_mode: input.pricing_mode ?? null,
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || DEFAULT_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userPrompt) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`openai_error_${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '{}';

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('openai_invalid_json');
  }

  const normalized = {
    ...parsed,
    subcategory: parsed.subcategory ?? null,
  };

  return openAiResponseSchema.parse(normalized);
}

export function fallbackClassification(input: { name: string; fresh?: boolean | null }): AiClassification {
  const name = input.name.toLowerCase();
  let category = 'Outros';
  let subcategory: string | null = null;

  if (name.includes('camar')) category = 'Camarão';
  else if (name.includes('tiláp') || name.includes('tilapia') || name.includes('merlu')) category = 'Peixes';
  else if (name.includes('salm')) category = 'Peixes';
  else if (name.includes('carne') || name.includes('bov')) category = 'Carnes';
  else if (name.includes('frango') || name.includes('ave')) category = 'Aves';

  const menu_group = input.fresh ? 'Frescos' : 'Congelados';
  const tags = Array.from(new Set([
    category.toLowerCase(),
    input.fresh ? 'fresco' : 'congelado',
    'proteína',
  ])).slice(0, 5);

  return {
    normalized_name: input.name,
    category,
    subcategory,
    menu_group,
    tags,
    confidence: 0.3,
  };
}
