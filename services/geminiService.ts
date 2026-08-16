import { GoogleGenAI, Type } from "@google/genai";
import { VocabWord } from "../types";

// User provided API keys for rotation/fallback
const API_KEYS = [
  "AIzaSyCs2DYeYmYrNcbzVWcoyxPtahb1c6FWfIw",
  "AIzaSyBrni5E1idQmj5FZ6Wl06ARjRE-Ppoeo-Y",
  "AIzaSyCLpBcb4APDJasF1CFwFDx6gz7VBhtzLu8",
  "AIzaSyDzbS8tWy-Zix9YCE8dO78MEAd-ZDuhC54",
  "AIzaSyBc3axRKxwZ9mszuhhEwLr5RxEWVIbYc4I",
  "AIzaSyDHqval_FeUigLofT0aBmbSvduyzj-sM4Y",
  "AIzaSyBISrESnWdIRPC8Gkpq6z4ThFVKfkAO1Dw",
  "AIzaSyAUEPZNyozDgWaFb-iyT6Y5uxYosuZOBFU",
  "AIzaSyC5EnTzW37iQIiEk0zyh8zySWmTLJHwoR4"
];

// Helper to safely get API Key in various environments (Vite, Next.js, etc)
const getApiKey = (): string | undefined => {
  // 1. Try process.env (Standard Node / Webpack / AI Studio environment)
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  // 2. Try import.meta.env (Vite Standard for Vercel deployments)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY;
  }
  
  // 3. Fallback to provided key pool (Random rotation)
  if (API_KEYS.length > 0) {
    const randomIndex = Math.floor(Math.random() * API_KEYS.length);
    return API_KEYS[randomIndex];
  }

  return undefined;
};

export const analyzeSongVibe = async (
  lyrics: string, 
  artist: string, 
  title: string,
  album: string, // Added album context
  coverUrl?: string
) => {
  // Defaults
  const defaultResult = {
    vibe: "Cinematic Atmosphere",
    colors: ["#1a1a1a", "#ffffff", "#888888"],
    speed: 0.5,
    fontStyle: "serif",
    imagePrompt: "Impasto oil painting of a landscape, heavy texture, artistic, 8k resolution",
    searchQuery: "oil painting texture wallpaper",
    sources: [] as { title: string; uri: string }[]
  };

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("No API Key provided for Gemini. Please set VITE_API_KEY in Vercel.");
    return defaultResult;
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  // Enhanced Prompt with Deep Search & Artistic Reasoning
  const textPrompt = `
  Role: Elite Art Director & Music Researcher for a high-end Aesthetic Lyric Video Channel.
  
  **OBJECTIVE**: 
  Create a highly artistic, physical-medium-based image prompt that perfectly captures the "Soul" of the song "${title}" by "${artist}".
  
  **STEP 1: DEEP RESEARCH (Use Google Search)**
  You MUST search for the following information to build a complete understanding. 
  *Do NOT search for lyrics text (I have provided it).*
  
  1.  **Creator Intent**: Search for interviews with the composer/lyricist. Why did they write this? What emotion did they want to convey? (Keywords: interview, meaning, behind the scenes, commentary).
  2.  **Visual Concept**: Search for the official album jacket shoot concept or music video art direction.
  3.  **Social Sentiment**: Search for fan interpretations on social platforms (Reddit, TheQoo, Instiz, X/Twitter). How do fans *feel* about this song? Is it sad? Hopeful? A "winter song"? A "breakup anthem"?
      *   *Search Strategy*: "${title} ${artist} meaning theory explanation", "${title} ${artist} review site:reddit.com OR site:theqoo.net"
  
  **STEP 2: ARTISTIC MEDIUM SELECTION**
  Based on the gathered sentiment, select **ONE** specific **PHYSICAL HAND-DRAWN MEDIUM**. Do NOT use digital 3D/CGI.
  Choose from:
  - **Impasto Oil Painting**: Heavy, thick texture. (Good for: Intense emotion, tragedy, classical).
  - **Soft Pastel / Chalk**: Dusty, blurry, gentle. (Good for: Dreamy, romance, nostalgia).
  - **Colored Pencils**: Visible strokes, rough paper grain. (Good for: Acoustic, innocence, diary-like, raw).
  - **Crayons / Oil Pastels**: Waxy texture, child-like or chaotic. (Good for: Playful, weird, or psychological horror).
  - **Markers / Felt Tip**: Bold lines, bleeding ink. (Good for: Pop, modern, doodle).
  - **Watercolor**: Wet, bleeding edges, transparent. (Good for: Sadness, rain, memory).
  - **Charcoal / Graphite**: Grayscale, messy, smudged. (Good for: Dark, depressed, vintage).
  
  **STEP 3: SYNTHESIS & OUTPUT**
  Combine the **Album Cover Colors** (extract from image provided) with your **Research Findings** to generate the JSON.
  
  **OUTPUT JSON FORMAT**:
  {
    "vibe": "Short 2-word aesthetic mood (e.g. 'Vintage Melancholy')",
    "palette": ["#HexFromCover1", "#HexFromCover2", "#HexFromCover3"],
    "imagePrompt": "Art Style: [Selected Medium]. Subject: [Concrete Metaphor based on research]. Texture Details: [Specific texture keywords like 'thick brushstrokes', 'paper grain', 'waxy']. Lighting/Mood: [Based on song meaning]. High quality masterpiece.",
    "searchQuery": "Keywords for finding similar textures (e.g. 'colored pencil cloud drawing texture')"
  }
  
  Input Lyrics Snippet:
  ${lyrics.substring(0, 800)}...
  `;

  try {
    const parts: any[] = [];
    
    // Optimize image payload
    if (coverUrl && coverUrl.startsWith('data:') && coverUrl.length < 1000000) {
        const base64Data = coverUrl.split(',')[1];
        const mimeType = coverUrl.split(';')[0].split(':')[1];
        parts.push({
            inlineData: {
                data: base64Data,
                mimeType: mimeType
            }
        });
    }

    parts.push({ text: textPrompt });

    // Use Gemini 2.5 Flash with Thinking Config for deeper reasoning while keeping it fast/free-tier friendly.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: parts },
      config: {
        tools: [{ googleSearch: {} }],
        // Enable Thinking to allow the model to plan its search and reason about art styles
        thinkingConfig: { thinkingBudget: 4096 } 
      }
    });

    // 1. Extract Grounding Metadata (Sources)
    const sources: { title: string; uri: string }[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
        chunks.forEach((chunk: any) => {
            if (chunk.web) {
                sources.push({ title: chunk.web.title, uri: chunk.web.uri });
            }
        });
    }

    // 2. Parse JSON from text response
    let jsonText = response.text || "{}";
    jsonText = jsonText.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    
    let json;
    if (firstBrace !== -1 && lastBrace !== -1) {
        try {
            json = JSON.parse(jsonText.substring(firstBrace, lastBrace + 1));
        } catch (e) {
            console.warn("JSON parse failed, falling back to defaults");
        }
    }

    if (!json) return defaultResult;
    
    return {
      vibe: json.vibe || "Artistic View",
      colors: (json.palette && json.palette.length >= 3) ? json.palette : defaultResult.colors,
      speed: 0.5,
      fontStyle: "serif",
      imagePrompt: json.imagePrompt || defaultResult.imagePrompt,
      searchQuery: json.searchQuery || defaultResult.searchQuery,
      sources: sources
    };
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return defaultResult;
  }
};

/**
 * Generates an aesthetic image using the specified model.
 * @param prompt 
 * @param model 'gemini-2.5-flash-image' (Nano Banana), 'gemini-3-pro-image-preview' (Nano Banana Pro), or 'imagen-4.0-generate-001'
 */
export const generateAestheticImage = async (prompt: string, model: string = 'gemini-2.5-flash-image'): Promise<string | null> => {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey: apiKey });

  try {
    // Suffix emphasizes texture and authenticity, avoiding the "smooth AI" look
    const styleSuffix = ", masterpiece, highly detailed texture, authentic material look, 8k resolution, no text, no watermark. (Art Style: Hand-drawn / Physical Medium)";
    const fullPrompt = prompt + styleSuffix;

    // A. IMAGEN MODELS (3.0 or 4.0)
    if (model.startsWith('imagen')) {
        const response = await ai.models.generateImages({
            model: model,
            prompt: fullPrompt,
            config: {
                numberOfImages: 1,
                aspectRatio: '16:9',
                outputMimeType: 'image/jpeg',
            },
        });
        const base64Data = response.generatedImages?.[0]?.image?.imageBytes;
        if (base64Data) {
            return `data:image/jpeg;base64,${base64Data}`;
        }
    } 
    // B. GEMINI NANO BANANA MODELS (Flash / Pro)
    else {
        const isPro = model.includes('pro');
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: fullPrompt }] },
            config: {
                imageConfig: {
                    aspectRatio: "16:9",
                    // Use 2K for Pro model, otherwise standard
                    ...(isPro ? { imageSize: "2K" } : {})
                }
            }
        });

        // Iterate through parts to find the image
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    return `data:${mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
    }

    return null;

  } catch (error) {
    console.error(`Gemini Image generation failed (${model}):`, error);
    throw error; // Throw error so UI can show alert
  }
};

/**
 * Generates a background video using Veo.
 * @param prompt 
 * @param model 'veo-3.1-fast-generate-preview' or 'veo-3.1-generate-preview'
 */
export const generateBackgroundVideo = async (prompt: string, model: string = 'veo-3.1-fast-generate-preview'): Promise<string | null> => {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  const ai = new GoogleGenAI({ apiKey: apiKey });

  try {
    // Video prompt tailored for slow, atmospheric, textured motion
    const videoPrompt = prompt + ", slow camera movement, heavy texture, cinematic lighting, high resolution, ambient motion, atmospheric, dreamy, highly detailed";

    let operation = await ai.models.generateVideos({
      model: model,
      prompt: videoPrompt,
      config: {
        numberOfVideos: 1,
        resolution: '1080p',
        aspectRatio: '16:9'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (videoUri) {
        return `${videoUri}&key=${apiKey}`;
    }
    return null;

  } catch (error) {
      console.error(`Veo Video generation failed (${model}):`, error);
      return null;
  }
};

export const searchLexicaImages = async (query: string): Promise<string[]> => {
    try {
        const enhancedQuery = query.includes('texture') ? query : `${query} artistic texture wallpaper`;
        const response = await fetch(`https://lexica.art/api/v1/search?q=${encodeURIComponent(enhancedQuery)}`);
        if (!response.ok) throw new Error("Lexica API failed");
        const data = await response.json();
        return data.images.map((img: any) => img.src).slice(0, 24);
    } catch (e) {
        return [];
    }
}

/**
 * Generates image using Pollinations.ai (Free, no quota)
 */
export const generateFastImage = (prompt: string, seed?: number, model: string = 'flux'): string => {
    const keywords = prompt.split(' ')
        .filter(w => w.length > 3)
        .slice(0, 15)
        .join(' ');
        
    const encodedPrompt = encodeURIComponent(keywords + " hand drawn style, colored pencil, oil painting, texture, noise, art photography");
    const randomSeed = seed !== undefined ? seed : Math.floor(Math.random() * 10000);
    // Pollinations models: 'flux', 'turbo', 'flux-realism', 'any-dark'
    return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&nologo=true&seed=${randomSeed}&model=${model}`;
};

/**
 * Generates Romanization for Korean lyrics
 */
export const generateRomanization = async (lyrics: string[]): Promise<string[]> => {
    const apiKey = getApiKey();
    if (!apiKey) return lyrics;
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // Processing in chunks to avoid context limit and timeouts
    const chunkDetails = lyrics.join("\n");

    const prompt = `
    You are a professional K-Pop lyric translator.
    Convert the following Korean lyrics to Romanization.
    Return ONLY the romanized lines, line by line, matching the input count.
    No extra text, no headers.
    
    Lyrics:
    ${chunkDetails}
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt
        });
        
        const text = response.text || "";
        return text.split("\n").filter(l => l.trim() !== "");
    } catch (e) {
        console.error("Romanization failed", e);
        return lyrics.map(() => "");
    }
}

/**
 * Extracts key vocabulary from lyrics
 */
export const extractVocabulary = async (lyrics: string): Promise<VocabWord[]> => {
    const apiKey = getApiKey();
    if (!apiKey) return [];
    const ai = new GoogleGenAI({ apiKey: apiKey });

    const prompt = `
    Analyze these K-Pop lyrics and extract 3 key Korean vocabulary words that are interesting for learners.
    Return a JSON array of objects with 'word' (Korean), 'meaning' (Traditional Chinese), and 'pronunciation' (Romanization).
    
    Lyrics:
    ${lyrics.substring(0, 1000)}
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            word: { type: Type.STRING },
                            meaning: { type: Type.STRING },
                            pronunciation: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        
        return JSON.parse(response.text || "[]");
    } catch (e) {
        console.error("Vocab extraction failed", e);
        return [];
    }
}

/**
 * Generates engaging social media posts (Threads, IG Captions)
 * UPDATED: Uses Professional Persona, Deep Lyric Interpretation, and Human-like writing style.
 */
export const generateSocialPosts = async (
    title: string,
    artist: string,
    lyricsSnippet: string
): Promise<{ content: string; tags: string[] }> => {
    const apiKey = getApiKey();
    if (!apiKey) return { content: "請設定 API Key", tags: [] };
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    const prompt = `
    你現在是【最專業的 Threads 社群小編】。
    你的任務是為歌曲 "${title}" (歌手: ${artist}) 撰寫一篇極具吸引力、充滿文學造詣與「言外之意」詮釋的 Threads 貼文。

    **步驟 1: 深度歌詞分析 (Thinking Mode)**
    請仔細閱讀下方提供的【完整歌詞片段】，利用你的文學素養理解其表面意思與深層隱喻。
    *嚴禁* 上網搜尋歌詞文本，請直接分析我提供的這段文字。
    
    歌詞片段參考：
    ${lyricsSnippet.substring(0, 1500)}

    **步驟 2: 背景資料搜尋 (Google Search)**
    請使用 Google Search 查詢以下補充資訊 (不要查歌詞)：
    - 這首歌的製作緣由、幕後故事、作曲家訪談。
    - 粉絲對這首歌的獨特情感解讀或理論。
    - 歌曲發行時的背景或氛圍。

    **步驟 3: 撰寫貼文**
    - **語言**: 繁體中文 (Traditional Chinese)。
    - **風格**: 文學感強、感性、像人類撰寫的（避免 AI 生成感）、帶有深度解析與個人觀點。
    - **內容要求**:
      1. 必須自然地融入/引用一句【原文歌詞】(韓文/日文/英文) 並簡單帶出其意境。
      2. 結合你在步驟 1 的歌詞分析與步驟 2 的搜尋故事。
      3. 引發讀者強烈共鳴，讓他們覺得「天啊，原來這首歌是這個意思」。
    - **長度**: 100 ~ 500 字。

    **步驟 4: 標籤**
    - 生成 5 個相關的 Hashtag。

    **輸出格式**:
    請直接回傳一個有效的 JSON 物件 (不要 Markdown code block)，格式如下：
    {
        "content": "你的貼文內容...",
        "tags": ["#Tag1", "#Tag2"]
    }
    `;

    try {
        // IMPORTANT: Do NOT use responseMimeType: 'application/json' with googleSearch tool.
        // We rely on the prompt to request JSON format and parse manually.
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                // Enable thinking for deep lyric interpretation
                thinkingConfig: { thinkingBudget: 4096 }
            }
        });
        
        let jsonText = response.text || "{}";
        // Clean up markdown code blocks if present
        jsonText = jsonText.replace(/```json/g, "").replace(/```/g, "").trim();

        // Extract JSON using brace matching
        const firstBrace = jsonText.indexOf('{');
        const lastBrace = jsonText.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
             const cleanedJson = jsonText.substring(firstBrace, lastBrace + 1);
             return JSON.parse(cleanedJson);
        }

        // Fallback: If parsing failed but we have text, return it as content
        if (jsonText.length > 20) {
            return { content: jsonText, tags: [] };
        }

        return { content: "無法生成內容", tags: [] };

    } catch (e) {
        console.error("Social post generation failed", e);
        return { content: "生成失敗，請稍後再試。", tags: [] };
    }
}