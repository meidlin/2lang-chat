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
    console.log('🌐 TranslationService.translateText called:', { text, fromLanguage, toLanguage });
    const from = fromLanguage.toLowerCase();
    const to = toLanguage.toLowerCase();
    
    if (!this.apiKey) {
      console.log('⚠️ No OpenAI API key, trying fallback services...');
      // Try multiple fallback services in parallel with timeout
      return this.translateWithFallbacks(text, from, to);
    }

    if (fromLanguage === toLanguage) {
      return { translatedText: text };
    }

    // Try OpenAI API with retry logic
    return this.translateWithRetry(text, from, to);
  }

  private async translateWithRetry(text: string, from: string, to: string, maxRetries: number = 2): Promise<TranslationResponse> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 OpenAI translation attempt ${attempt}/${maxRetries}`);
        return await this.translateWithOpenAI(text, from, to);
      } catch (error) {
        console.error(`❌ OpenAI attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          console.log('🔄 All OpenAI attempts failed, trying fallbacks...');
          return this.translateWithFallbacks(text, from, to);
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
    
    return this.getMockTranslation(text, from, to);
  }

  private async translateWithOpenAI(text: string, from: string, to: string): Promise<TranslationResponse> {
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

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo', // Use faster model
          messages: [
            {
              role: 'system',
              content: `Translate from ${fromLangName} to ${toLangName}. Output only the translation.`
            },
            {
              role: 'user',
              content: text
            }
          ],
          max_tokens: 500, // Reduced for faster response
          temperature: 0.1, // Lower temperature for more consistent results
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('OpenAI API error response:', { status: response.status, text: errorText });
        
        if (response.status === 429) {
          throw new Error('Rate limit exceeded - too many requests');
        } else if (response.status === 401) {
          throw new Error('Invalid API key');
        } else if (response.status >= 500) {
          throw new Error('Server error - please try again');
        } else {
          throw new Error(`Translation API error: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      const translatedText = data.choices[0]?.message?.content?.trim();

      if (!translatedText) {
        throw new Error('No translation received from API');
      }

      return { translatedText };
    } catch (error) {
      console.error('OpenAI translation error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error; // Re-throw to be caught by retry logic
    }
  }

  private async translateWithFallbacks(text: string, fromLanguage: string, toLanguage: string): Promise<TranslationResponse> {
    console.log('🔄 Trying fallback translation services...');
    
    // Try all fallback services in parallel with timeout
    const promises = [
      this.translateViaLibreTranslate(text, fromLanguage, toLanguage).catch(e => {
        console.error('❌ LibreTranslate failed:', e);
        return { error: e };
      }),
      this.translateViaMyMemory(text, fromLanguage, toLanguage).catch(e => {
        console.error('❌ MyMemory failed:', e);
        return { error: e };
      }),
      this.translateViaGoogleTranslate(text, fromLanguage, toLanguage).catch(e => {
        console.error('❌ Google Translate failed:', e);
        return { error: e };
      })
    ];

    try {
      const results = await Promise.allSettled(promises);
      
      for (const result of results) {
        if (result.status === 'fulfilled' && typeof result.value === 'string') {
          const translation = result.value;
          if (this.isTargetLanguageSatisfied(translation, toLanguage)) {
            console.log('✅ Fallback translation success:', translation);
            return { translatedText: translation };
          }
        }
      }
      
      console.log('⚠️ All fallbacks failed, using mock translation');
      return this.getMockTranslation(text, fromLanguage, toLanguage);
    } catch (error) {
      console.error('All fallback services failed:', error);
      return this.getMockTranslation(text, fromLanguage, toLanguage);
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

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let lastError: unknown = null;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
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
    
    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
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
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async translateViaGoogleTranslate(text: string, fromLanguage: string, toLanguage: string): Promise<string> {
    // Use Google Translate's public API (unofficial but fast)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLanguage}&tl=${toLanguage}&dt=t&q=${encodeURIComponent(text)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        throw new Error(`Google Translate error ${res.status}`);
      }
      
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0]) && data[0].length > 0) {
        const translation = data[0].map((item: any) => item[0]).join('');
        if (translation && translation.trim()) {
          return translation.trim();
        }
      }
      throw new Error('Invalid response from Google Translate');
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private getMockTranslation(text: string, fromLanguage: string, toLanguage: string): TranslationResponse {
    // Generic fallback that echoes the original when no API is available
    const mockTranslation = `[${fromLanguage}→${toLanguage}] ${text}`;
    console.log('🎭 Using mock translation:', mockTranslation);
    return { translatedText: mockTranslation };
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
