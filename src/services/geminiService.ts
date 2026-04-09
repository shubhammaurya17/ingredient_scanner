import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { ScanResult, AnalysisMode } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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
    better_alternatives_guidance: { type: Type.STRING }
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
  const model = "gemini-3-flash-preview";
  const prompt = `
    Extract the product name and the full list of ingredients from this food label. 
    Also extract the nutrition facts table text if visible.
    Return as JSON.
  `;

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
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    if (!response.text) {
      throw new Error("No response from Gemini during extraction");
    }

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Extraction error:", error);
    throw error;
  }
}

export async function analyzeIngredientsFromText(
  productName: string, 
  ingredientsText: string, 
  nutritionText: string | undefined, 
  mode: AnalysisMode = "General"
): Promise<ScanResult> {
  const model = "gemini-3-flash-preview";
  
  const modeInstructions: Record<string, string> = {
    General: "General consumer health analysis.",
    Diabetic: "Focus on glycemic index and hidden sugars.",
    Kids: "Focus on artificial colors and high sugar.",
    Gym: "Focus on protein quality and fillers."
  };

  const prompt = `
    Analyze this food product based on the provided text.
    Product: ${productName}
    Ingredients: ${ingredientsText}
    Nutrition Info: ${nutritionText || "Not provided"}
    Mode: ${mode}. Focus: ${modeInstructions[mode] || modeInstructions.General}.
    
    Indian Label Context:
    - Handle FSSAI labeling and INS codes.
    - Be critical of Palm Oil/Vanaspati.
    - RULE: If sugar > 50% weight, verdict MUST be "Avoid".
    
    Tasks:
    1. Identify additives and risks.
    2. Score health (0-100) and risk.
    3. Verdict: Good/Moderate/Bad. Action: Good Choice/Not Ideal/Avoid.
    4. Top 3 reasons.
    5. Score breakdown.
    6. Confidence level.
    7. Suitability (Children, Diabetics, etc.).
    8. Ingredient risk levels.
    9. Processing level.
    10. Better alternatives.
    11. Use standard units (g, mg, kcal, ml) with space.
    12. No medical diagnosis.
    13. JSON output only.
  `;

  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: SCAN_RESULT_SCHEMA,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      if (!response.text) {
        throw new Error("No response from Gemini during analysis");
      }

      return JSON.parse(response.text) as ScanResult;
    } catch (error: any) {
      const is503 = error?.message?.includes("503") || error?.status === 503 || error?.code === 503;
      
      if (is503 && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Failed to analyze text after retries.");
}

export async function analyzeIngredientLabel(base64Image: string, mimeType: string, mode: AnalysisMode = "General"): Promise<ScanResult> {
  const model = "gemini-3-flash-preview";
  
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

  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
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
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      if (!response.text) {
        throw new Error("No response from Gemini");
      }

      return JSON.parse(response.text) as ScanResult;
    } catch (error: any) {
      const is503 = error?.message?.includes("503") || error?.status === 503 || error?.code === 503;
      
      if (is503 && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.warn(`Gemini 503 error (high demand). Retrying in ${delay}ms... (Attempt ${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      console.error("Gemini analysis error:", error);
      throw error;
    }
  }

  throw new Error("Failed to analyze image after multiple retries due to high demand.");
}
