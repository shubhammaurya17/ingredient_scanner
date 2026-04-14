import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { ScanResult, AnalysisMode, ProductRecommendation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const RECOMMENDATION_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      product_name: { type: Type.STRING },
      brand: { type: Type.STRING },
      reason: { type: Type.STRING }
    },
    required: ["product_name", "brand", "reason"]
  }
};

const SCAN_RESULT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    product_name: { type: Type.STRING },
    ocr_confidence: { type: Type.NUMBER },
    analysis_confidence: { type: Type.NUMBER },
    confidence_level: { type: Type.STRING, enum: ["High", "Moderate", "Low"] },
    confidence_reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
    overall_verdict: { type: Type.STRING, enum: ["Good", "Moderate", "Bad"] },
    verdict_action: { type: Type.STRING, enum: ["Good Choice", "Not Ideal", "Avoid"] },
    health_score: { type: Type.NUMBER },
    ingredient_risk_score: { type: Type.NUMBER },
    why_summary: { type: Type.STRING },
    top_reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
    score_breakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          factor: { type: Type.STRING },
          impact: { type: Type.NUMBER }
        },
        required: ["factor", "impact"]
      }
    },
    confirmed_facts: { type: Type.ARRAY, items: { type: Type.STRING } },
    ai_estimates: { type: Type.ARRAY, items: { type: Type.STRING } },
    nutrition_summary: {
      type: Type.OBJECT,
      properties: {
        sugar: { type: Type.OBJECT, properties: { value: { type: Type.STRING }, level: { type: Type.STRING, enum: ["Low", "Moderate", "High"] } }, required: ["value", "level"] },
        sodium: { type: Type.OBJECT, properties: { value: { type: Type.STRING }, level: { type: Type.STRING, enum: ["Low", "Moderate", "High"] } }, required: ["value", "level"] },
        protein: { type: Type.OBJECT, properties: { value: { type: Type.STRING }, level: { type: Type.STRING, enum: ["Low", "Moderate", "High"] } }, required: ["value", "level"] },
        fiber: { type: Type.OBJECT, properties: { value: { type: Type.STRING }, level: { type: Type.STRING, enum: ["Low", "Moderate", "High"] } }, required: ["value", "level"] },
        saturated_fat: { type: Type.OBJECT, properties: { value: { type: Type.STRING }, level: { type: Type.STRING, enum: ["Low", "Moderate", "High"] } }, required: ["value", "level"] }
      },
      required: ["sugar", "sodium", "protein", "fiber", "saturated_fat"]
    },
    ingredient_breakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          simple_name: { type: Type.STRING },
          category: { type: Type.STRING },
          what_it_is: { type: Type.STRING },
          why_used: { type: Type.STRING },
          possible_benefits: { type: Type.ARRAY, items: { type: Type.STRING } },
          possible_risks: { type: Type.ARRAY, items: { type: Type.STRING } },
          estimated_quantity_note: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          source_type: { type: Type.STRING, enum: ["confirmed", "estimated", "low_confidence"] },
          risk_level: { type: Type.STRING, enum: ["Low", "Medium", "High"] }
        },
        required: ["name", "simple_name", "category", "what_it_is", "why_used", "risk_level", "source_type"]
      }
    },
    suitability_flags: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          group: { type: Type.STRING },
          status: { type: Type.STRING, enum: ["Suitable", "Caution", "Avoid"] },
          reason: { type: Type.STRING },
          confidence: { type: Type.NUMBER }
        },
        required: ["group", "status", "reason"]
      }
    },
    allergen_flags: { type: Type.ARRAY, items: { type: Type.STRING } },
    warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
    raw_ocr_text: { type: Type.STRING },
    processing_level: { type: Type.STRING },
    better_alternatives_guidance: { type: Type.STRING },
    recommended_products: RECOMMENDATION_SCHEMA
  },
  required: ["product_name", "overall_verdict", "verdict_action", "health_score", "ingredient_breakdown", "confidence_level", "top_reasons", "score_breakdown", "nutrition_summary", "suitability_flags", "better_alternatives_guidance"]
};

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    product_name: { type: Type.STRING },
    ingredients_text: { type: Type.STRING },
    nutrition_text: { type: Type.STRING }
  },
  required: ["product_name", "ingredients_text"]
};

export async function extractIngredientsText(base64Image: string, mimeType: string): Promise<{ product_name: string, ingredients_text: string, nutrition_text?: string }> {
  const primaryModel = "gemini-3.1-flash-lite-preview";
  const fallbackModel = "gemini-flash-latest";
  const prompt = `
    OCR food label. 
    1. Product Name.
    2. Ingredients list.
    3. Nutrition table.
    JSON only.
  `;

  const maxRetries = 5;
  let retryCount = 0;
  let useFallback = false;

  while (retryCount <= maxRetries) {
    const model = (retryCount >= 3 || useFallback) ? fallbackModel : primaryModel;
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { data: base64Image.split(',')[1] || base64Image, mimeType } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: EXTRACTION_SCHEMA,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
        }
      });

      if (!response.text) {
        throw new Error("No response from Gemini during extraction");
      }

      return JSON.parse(response.text);
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const isQuotaExceeded = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED");
      const isRetryable = isQuotaExceeded || errorMsg.includes("503") || errorMsg.includes("high demand") || error?.status === 503 || error?.code === 503;
      
      if (isRetryable && retryCount < maxRetries) {
        retryCount++;
        if (isQuotaExceeded) useFallback = true;
        
        const delay = isQuotaExceeded ? 1000 : Math.pow(2, retryCount) * 1000;
        console.warn(`Gemini extraction retry ${retryCount}/${maxRetries} using ${useFallback ? fallbackModel : primaryModel} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      console.error("Extraction error:", error);
      throw error;
    }
  }
  throw new Error("Failed to extract text after multiple retries.");
}

export async function analyzeIngredientsFromText(
  productName: string, 
  ingredientsText: string, 
  nutritionText: string | undefined, 
  mode: AnalysisMode = "General"
): Promise<ScanResult> {
  const primaryModel = "gemini-3.1-flash-lite-preview";
  const fallbackModel = "gemini-flash-latest";
  
  const modeInstructions: Record<string, string> = {
    General: "General health.",
    Diabetic: "Glycemic index, hidden sugars.",
    Kids: "Artificial colors, sugar.",
    Gym: "Protein quality, fillers."
  };

  const prompt = `
    Analyze food product.
    Product: ${productName}
    Ingredients: ${ingredientsText}
    Nutrition: ${nutritionText || "N/A"}
    Mode: ${mode} (${modeInstructions[mode] || modeInstructions.General}).
    
    Context: Indian FSSAI, INS codes. Critical of Palm Oil. Sugar > 50% = Avoid.
    
    Output JSON:
    - product_name
    - health_score (0-100)
    - overall_verdict (Good/Moderate/Bad)
    - verdict_action (Good Choice/Not Ideal/Avoid)
    - top_reasons (3)
    - score_breakdown
    - nutrition_summary (sugar, sodium, protein, fiber, saturated_fat)
    - ingredient_breakdown (name, simple_name, category, what_it_is, why_used, risk_level, source_type)
    - suitability_flags (group, status, reason)
    - better_alternatives_guidance
    - processing_level
  `;

  const maxRetries = 5;
  let retryCount = 0;
  let useFallback = false;

  while (retryCount <= maxRetries) {
    const model = (retryCount >= 3 || useFallback) ? fallbackModel : primaryModel;
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: SCAN_RESULT_SCHEMA,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
        }
      });

      if (!response.text) {
        throw new Error("No response from Gemini during analysis");
      }

      return JSON.parse(response.text) as ScanResult;
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const isQuotaExceeded = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED");
      const isRetryable = isQuotaExceeded || errorMsg.includes("503") || errorMsg.includes("429") || errorMsg.includes("high demand") || error?.status === 503 || error?.code === 503;
      
      if (isRetryable && retryCount < maxRetries) {
        retryCount++;
        if (isQuotaExceeded) useFallback = true;

        const delay = isQuotaExceeded ? 1000 : Math.pow(2, retryCount) * 1000;
        console.warn(`Gemini analysis retry ${retryCount}/${maxRetries} using ${useFallback ? fallbackModel : primaryModel} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Failed to analyze text after multiple retries.");
}

export async function analyzeIngredientLabel(base64Image: string, mimeType: string, mode: AnalysisMode = "General"): Promise<ScanResult> {
  const primaryModel = "gemini-3.1-flash-lite-preview";
  const fallbackModel = "gemini-flash-latest";
  
  const modeInstructions: Record<string, string> = {
    General: "General consumer health analysis.",
    Diabetic: "Focus on glycemic index and hidden sugars.",
    Kids: "Focus on artificial colors and high sugar.",
    Gym: "Focus on protein quality and fillers."
  };

  const prompt = `
    Analyze this food label image. Mode: ${mode}. Focus: ${modeInstructions[mode] || modeInstructions.General}.
    
    Indian Label Context:
    - Handle FSSAI labeling and INS codes.
    - Be critical of Palm Oil/Vanaspati.
    - RULE: If sugar > 50% weight, verdict MUST be "Avoid".
    
    Nutrition Snapshot Extraction:
    - Extract values for Sugar, Sodium, Protein, Fiber, and Saturated Fat.
    - IMPORTANT: If the label provides values "per 100g", use those directly. If it provides values "per serving", calculate the equivalent "per 100g" if the serving size is clear, otherwise state the value as is but specify the unit.
    - Be extremely precise with numbers. If a value is "0g", report "0g".
    - If a value is not found, estimate based on ingredients but mark as estimate in the summary.
    
    Tasks:
    1. OCR text.
    2. Identify ingredients and additives.
    3. Score health (0-100) and risk.
    4. Verdict: Good/Moderate/Bad. Action: Good Choice/Not Ideal/Avoid.
    5. Top 3 reasons.
    6. Score breakdown.
    7. Confidence level.
    8. Suitability (Children, Diabetics, etc.).
    9. Ingredient risk levels.
    10. Processing level.
    11. Better alternatives.
    12. Use standard units (g, mg, kcal, ml) with space.
    13. No medical diagnosis.
    14. JSON output only.
  `;

  const maxRetries = 5;
  let retryCount = 0;
  let useFallback = false;

  while (retryCount <= maxRetries) {
    const model = (retryCount >= 3 || useFallback) ? fallbackModel : primaryModel;
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { data: base64Image.split(',')[1] || base64Image, mimeType } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: SCAN_RESULT_SCHEMA,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
        }
      });

      if (!response.text) {
        throw new Error("No response from Gemini");
      }

      return JSON.parse(response.text) as ScanResult;
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const isQuotaExceeded = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED");
      const isRetryable = isQuotaExceeded || errorMsg.includes("503") || errorMsg.includes("429") || errorMsg.includes("high demand") || error?.status === 503 || error?.code === 503;
      
      if (isRetryable && retryCount < maxRetries) {
        retryCount++;
        if (isQuotaExceeded) useFallback = true;

        const delay = isQuotaExceeded ? 1000 : Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.warn(`Gemini analysis retry ${retryCount}/${maxRetries} using ${useFallback ? fallbackModel : primaryModel} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      console.error("Gemini analysis error:", error);
      throw error;
    }
  }

  throw new Error("Failed to analyze image after multiple retries due to high demand.");
}

let quotaExceededUntil = 0;

export async function getProductRecommendations(
  productName: string,
  ingredients: string,
  mode: AnalysisMode = "General",
  isGoodProduct: boolean = false
): Promise<ProductRecommendation[]> {
  if (Date.now() < quotaExceededUntil) {
    console.warn("Skipping AI recommendations due to recent quota exhaustion.");
    return [];
  }

  const primaryModel = "gemini-3.1-flash-lite-preview";
  const fallbackModel = "gemini-flash-latest";

  const contextRule = isGoodProduct 
    ? `The current product is already a GOOD CHOICE. Suggest 2-3 premium, cleaner, or higher-quality alternatives (e.g., fewer ingredients, organic, more natural processing). ONLY suggest if they are CLEARLY better than the current product.`
    : `The current product is NOT GOOD (low score or health risks). Suggest 2-5 SAFER and healthier alternatives in the same category.`;

  const primaryPrompt = `
    Based on the following food product, suggest healthier product alternatives available in India.
    Product Name: ${productName}
    Ingredients: ${ingredients}
    Mode: ${mode}
    
    ${contextRule}
    
    CRITICAL RULE: Do not recommend alternatives unless they provide clear additional value to the user. If no significantly better options exist, return an empty array.
    
    Structure your response as a JSON array of objects:
    [
      {
        "product_name": "Specific Product Name",
        "brand": "Brand Name",
        "reason": "Short, specific reason why it's better (e.g., 'No added sugar', 'Whole grain based')"
      }
    ]
    
    Rules:
    - Must be real products available in India.
    - Must be in the same category.
    - Prioritize actionable, real-world product recommendations over generic advice.
    - No hallucinations.
  `;

  const fallbackPrompt = `
    Suggest REAL packaged food products available in India that are healthier alternatives to "${productName}".
    Ingredients of original: ${ingredients}
    
    ${contextRule}
    
    CRITICAL RULE: Do not recommend alternatives unless they provide clear additional value to the user.
    
    STRICT CONSTRAINTS:
    - Suggest REAL brands and product names (e.g., 'Kikkoman Less Sodium Soy Sauce' instead of 'Organic Soy Sauce').
    - Provide short, specific reasons why each is better.
    - Focus on widely available Indian or global brands in India.
    - JSON array only.
  `;

  async function callAI(prompt: string, modelName: string): Promise<ProductRecommendation[]> {
    const maxRetries = 5;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: RECOMMENDATION_SCHEMA,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
          }
        });
        if (!response.text) return [];
        return JSON.parse(response.text) as ProductRecommendation[];
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        const isQuotaExceeded = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED");
        const isRetryable = isQuotaExceeded || errorMsg.includes("503") || errorMsg.includes("high demand") || error?.status === 503 || error?.code === 503;

        if (isQuotaExceeded) {
          // Set a 1-minute global cooldown for recommendations if we hit a hard quota
          quotaExceededUntil = Date.now() + 60000;
        }

        if (isRetryable && retryCount < maxRetries) {
          retryCount++;
          // More aggressive backoff for quota errors
          const delay = isQuotaExceeded 
            ? (5000 * retryCount) + Math.floor(Math.random() * 2000) 
            : Math.pow(2, retryCount) * 1000;
            
          console.warn(`AI Recommendation retry ${retryCount}/${maxRetries} for ${modelName} after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (!isQuotaExceeded) {
          console.error("AI Recommendation call failed:", error);
        } else {
          console.warn("AI Recommendation quota exceeded. Cooling down for 60s.");
        }
        return [];
      }
    }
    return [];
  }

  // Layer 1: Primary AI Call
  let results = await callAI(primaryPrompt, primaryModel);

  // Validation Check
  const isValid = (recs: ProductRecommendation[]) => {
    if (!recs || recs.length === 0) return false;
    const isGeneric = recs.some(r => r.product_name.toLowerCase().includes("organic") && !r.brand);
    const hasBrand = recs.every(r => r.brand && r.brand.length > 1);
    return !isGeneric && hasBrand;
  };

  if (!isValid(results)) {
    console.warn("Primary recommendations invalid or generic, triggering fallback...");
    // Layer 2: Fallback AI Call
    const fallbackResults = await callAI(fallbackPrompt, fallbackModel);
    if (isValid(fallbackResults)) {
      results = fallbackResults;
    }
  }

  // Final Merge & Cleanup
  const uniqueResults = results.filter((v, i, a) => a.findIndex(t => t.product_name === v.product_name && t.brand === v.brand) === i);
  
  return uniqueResults.slice(0, 5);
}
