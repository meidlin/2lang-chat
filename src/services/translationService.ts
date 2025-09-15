// Translation service using ChatGPT API
// You'll need to add your OpenAI API key to use this

interface TranslationResponse {
  translatedText: string;
  error?: string;
}

export class TranslationService {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.REACT_APP_OPENAI_API_KEY || '';
  }

  async translateText(
    text: string, 
    fromLanguage: string, 
    toLanguage: string
  ): Promise<TranslationResponse> {
    const from = fromLanguage.toLowerCase();
    const to = toLanguage.toLowerCase();
    if (!this.apiKey) {
      // Try public translation fallbacks when no OpenAI key is set
      try {
        const lt = await this.translateViaLibreTranslate(text, from, to);
        if (this.isTargetLanguageSatisfied(lt, to)) {
          return { translatedText: lt };
        }
      } catch (e1) {
        // continue
      }
      try {
        const mm = await this.translateViaMyMemory(text, from, to);
        if (this.isTargetLanguageSatisfied(mm, to)) {
          return { translatedText: mm };
        }
      } catch (e2) {
        // continue
      }
      return this.getMockTranslation(text, from, to);
    }

    if (fromLanguage === toLanguage) {
      return { translatedText: text };
    }

    try {
      const languageNames = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese',
        'ar': 'Arabic',
        'hi': 'Hindi'
      };

      const fromLangName = languageNames[from as keyof typeof languageNames] || from;
      const toLangName = languageNames[to as keyof typeof languageNames] || to;

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a professional translator. Translate the user's message from ${fromLangName} to ${toLangName}. Rules: 1) Output only the translation text (no quotes or commentary). 2) Use natural, polite ${toLangName}. 3) Do not romanize; use native script.`
            },
            {
              role: 'user',
              content: text
            }
          ],
          max_tokens: 1000,
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        throw new Error(`Translation API error: ${response.status}`);
      }

      const data = await response.json();
      const translatedText = data.choices[0]?.message?.content?.trim();

      if (!translatedText) {
        throw new Error('No translation received from API');
      }

      return { translatedText };
    } catch (error) {
      console.error('Translation error:', error);
      // Fallback to mock translation
      return this.getMockTranslation(text, from, to);
    }
  }

  private async translateViaLibreTranslate(text: string, fromLanguage: string, toLanguage: string): Promise<string> {
    const endpoints = [
      'https://libretranslate.com/translate',
      'https://translate.astian.org/translate',
      'https://libretranslate.de/translate'
    ];

    const payload = {
      q: text,
      source: fromLanguage,
      target: toLanguage,
      format: 'text'
    } as const;

    let lastError: unknown = null;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          throw new Error(`LibreTranslate error ${res.status}`);
        }
        const data = await res.json();
        if (data && typeof data.translatedText === 'string') {
          return data.translatedText as string;
        }
        throw new Error('Invalid response from LibreTranslate');
      } catch (err) {
        lastError = err;
        continue;
      }
    }
    throw lastError ?? new Error('All LibreTranslate endpoints failed');
  }

  private async translateViaMyMemory(text: string, fromLanguage: string, toLanguage: string): Promise<string> {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(fromLanguage)}|${encodeURIComponent(toLanguage)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`MyMemory error ${res.status}`);
    }
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (typeof translated === 'string' && translated.length > 0) {
      return translated;
    }
    // Try matches as fallback
    const match = Array.isArray(data?.matches) ? data.matches.find((m: any) => m?.translation) : null;
    if (match?.translation) {
      return match.translation as string;
    }
    throw new Error('Invalid response from MyMemory');
  }

  private getMockTranslation(text: string, fromLanguage: string, toLanguage: string): TranslationResponse {
    // Generic fallback that echoes the original when no API is available
    return { translatedText: `[${fromLanguage}→${toLanguage}] ${text}` };
  }

  private isTargetLanguageSatisfied(text: string, target: string): boolean {
    if (!text) return false;
    if (target === 'ja') {
      const jpRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf\uff66-\uff9f]/;
      return jpRegex.test(text);
    }
    return true;
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }
}

export const translationService = new TranslationService();
