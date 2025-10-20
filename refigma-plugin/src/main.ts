import uiHtml from '../ui/index.html?raw';
import { applyTokensDemo } from './tokens';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL ?? 'gemini-2.5-flash';

interface GeminiSiteContent {
  hero?: {
    title?: string;
    subtitle?: string;
    primaryCta?: string;
    secondaryCta?: string;
    assurance?: string;
    highlights?: string[];
  };
  metrics?: Array<{ value?: string; label?: string }>;
  testimonial?: {
    heading?: string;
    subtitle?: string;
    quote?: string;
    bullets?: string[];
    attribution?: string;
    attributionRole?: string;
    callout?: string;
  };
  cta?: {
    title?: string;
    subtitle?: string;
    primaryCta?: string;
    secondaryCta?: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

figma.showUI(uiHtml, { width: 340, height: 320 });

figma.on('run', async ({ command }) => {
  if (command === 'apply-tokens-demo') {
    await handleApplyTokens();
  }
});

figma.ui.onmessage = async (message) => {
  if (message && message.type === 'apply-tokens-demo') {
    await handleApplyTokens();
  } else if (message && message.type === 'generate-ai-site') {
    await handleGenerateAiSite(message.prompt);
  }
};

async function handleApplyTokens() {
  await applyTokensDemo();
  figma.notify('Refigma tokens applied to new frame.');
}

async function handleGenerateAiSite(prompt: unknown) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    postStatus('error', 'Masukkan prompt yang jelas untuk Gemini.');
    return;
  }
  if (!GEMINI_API_KEY) {
    postStatus('error', 'Konfigurasi Gemini API belum tersedia (VITE_GEMINI_API_KEY).');
    figma.notify('Set VITE_GEMINI_API_KEY di file .env anda.');
    return;
  }

  const cleanedPrompt = prompt.trim();
  try {
    postStatus('loading', 'Menghubungi Gemini untuk merumuskan konten...');
    const siteContent = await requestGeminiContent(cleanedPrompt);
    postStatus('applying', 'Menyiapkan layout Refigma berdasarkan konten Gemini...');
    const landing = await applyTokensDemo();
    await applyGeminiContent(landing, siteContent);
    postStatus('success', 'Website selesai digenerate di kanvas.');
    figma.notify('Website hasil Gemini sudah siap!');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat memanggil Gemini.';
    postStatus('error', message);
    figma.notify('Gagal menghasilkan website dari Gemini.');
    console.error('[Gemini]', error);
  }
}

function postStatus(status: 'loading' | 'applying' | 'success' | 'error', text: string) {
  figma.ui.postMessage({ type: 'generation-status', status, text });
}

async function requestGeminiContent(userPrompt: string): Promise<GeminiSiteContent> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
    GEMINI_API_KEY!,
  )}`;
  const prompt = buildGeminiPrompt(userPrompt);
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Gemini API error: ${response.statusText}`;
    try {
      const errorBody = await response.json();
      if (errorBody && errorBody.error && typeof errorBody.error.message === 'string') {
        message = errorBody.error.message;
      }
    } catch (error) {
      // ignore JSON parsing error, keep default message
    }
    throw new Error(message);
  }

  const data = (await response.json()) as GeminiResponse;
  let rawText = '';
  if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    const candidate = data.candidates[0];
    const parts = candidate.content && Array.isArray(candidate.content.parts) ? candidate.content.parts : [];
    rawText = parts
      .map((part) => {
        if (part && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .join('\n')
      .trim();
  }
  if (!rawText) {
    throw new Error('Gemini tidak mengembalikan konten.');
  }
  return parseGeminiJson(rawText);
}

function buildGeminiPrompt(userPrompt: string): string {
  return `Anda adalah AI copywriter dan information architect yang membantu mendesain landing page untuk plugin Figma.
Gunakan deskripsi berikut untuk memahami konteks: "${userPrompt}".
Balas HANYA dalam format JSON tanpa teks tambahan, menggunakan struktur berikut:
{
  "hero": {
    "title": string,
    "subtitle": string,
    "primaryCta": string,
    "secondaryCta": string,
    "assurance": string,
    "highlights": [string, string, string]
  },
  "metrics": [
    { "value": string, "label": string },
    { "value": string, "label": string },
    { "value": string, "label": string }
  ],
  "testimonial": {
    "heading": string,
    "subtitle": string,
    "quote": string,
    "bullets": [string, string, string],
    "attribution": string,
    "attributionRole": string,
    "callout": string
  },
  "cta": {
    "title": string,
    "subtitle": string,
    "primaryCta": string,
    "secondaryCta": string
  }
}
Isi seluruh bidang dengan kalimat yang relevan. Hindari karakter khusus yang tidak diperlukan.`;
}

function parseGeminiJson(rawText: string): GeminiSiteContent {
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Gemini tidak menghasilkan JSON yang valid.');
  }
  try {
    return JSON.parse(match[0]);
  } catch (error) {
    throw new Error('Gagal mem-parsing JSON dari Gemini.');
  }
}

async function applyGeminiContent(landing: FrameNode, content: GeminiSiteContent): Promise<void> {
  const hero = content.hero ? content.hero : {};
  await setText(findText(landing, 'Hero:Heading'), hero.title);
  await setText(findText(landing, 'Hero:Subheading'), hero.subtitle);
  await setText(findText(landing, 'HeroCTA:Primary:Label'), hero.primaryCta);
  await setText(findText(landing, 'HeroCTA:Secondary:Label'), hero.secondaryCta);
  await setText(findText(landing, 'Hero:Assurance'), hero.assurance);

  const highlightList = Array.isArray(hero.highlights) ? hero.highlights : [];
  for (let i = 0; i < 3; i += 1) {
    const highlight = highlightList[i];
    const highlightText = findText(landing, `Hero:Highlight:${i}:Text`);
    const highlightRow = landing.findOne((node) => node.name === `Hero:Highlight:${i}`) as FrameNode | null;
    if (highlight && highlightText) {
      await setText(highlightText, highlight);
      if (highlightRow) {
        highlightRow.visible = true;
      }
    } else if (highlightRow) {
      highlightRow.visible = false;
    }
  }

  const metrics = Array.isArray(content.metrics) ? content.metrics : [];
  for (let i = 0; i < 3; i += 1) {
    const metric = metrics[i];
    await setText(findText(landing, `HeroMetric:${i}:Value`), metric ? metric.value : undefined);
    await setText(findText(landing, `HeroMetric:${i}:Label`), metric ? metric.label : undefined);
  }

  const testimonial = content.testimonial ? content.testimonial : {};
  await setText(findText(landing, 'Testimonial:Heading'), testimonial.heading);
  await setText(findText(landing, 'Testimonial:Subtitle'), testimonial.subtitle);
  await setText(findText(landing, 'Testimonial:Quote'), testimonial.quote);
  await setText(findText(landing, 'Testimonial:Attribution'), testimonial.attribution);
  await setText(findText(landing, 'Testimonial:AttributionRole'), testimonial.attributionRole);
  await setText(findText(landing, 'Testimonial:Callout'), testimonial.callout);
  const testimonialBullets = Array.isArray(testimonial.bullets) ? testimonial.bullets : [];
  for (let i = 0; i < 3; i += 1) {
    const bullet = testimonialBullets[i];
    const bulletRow = landing.findOne((node) => node.name === `Testimonial:Bullet:${i}`) as FrameNode | null;
    const bulletText = findText(landing, `Testimonial:Bullet:${i}:Text`);
    if (bullet && bulletText) {
      await setText(bulletText, bullet);
      if (bulletRow) {
        bulletRow.visible = true;
      }
    } else if (bulletRow) {
      bulletRow.visible = false;
    }
  }

  const cta = content.cta ? content.cta : {};
  await setText(findText(landing, 'CTA:Heading'), cta.title);
  await setText(findText(landing, 'CTA:Body'), cta.subtitle);
  await setText(findText(landing, 'CTA:PrimaryLabel'), cta.primaryCta);
  await setText(findText(landing, 'CTA:SecondaryLabel'), cta.secondaryCta);
}

async function setText(node: TextNode | null, value?: string) {
  if (!node || value == null) {
    return;
  }
  const fontName = node.fontName;
  if (fontName === figma.mixed) {
    const length = node.characters.length;
    for (let i = 0; i < length; i += 1) {
      const rangeFont = node.getRangeFontName(i, i + 1);
      if (rangeFont !== figma.mixed) {
        await figma.loadFontAsync(rangeFont as FontName);
      }
    }
  } else {
    await figma.loadFontAsync(fontName as FontName);
  }
  node.characters = value;
}

function findText(root: FrameNode, name: string): TextNode | null {
  return root.findOne((node) => node.type === 'TEXT' && node.name === name) as TextNode | null;
}

declare const figma: PluginAPI;
