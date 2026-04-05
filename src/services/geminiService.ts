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

export async function analyzeIngredientLabel(base64Image: string, mimeType: string, mode: AnalysisMode = "General"): Promise<ScanResult> {
  const model = "gemini-3-flash-preview";
  
  const modeInstructions = {
    General: "Provide a balanced health analysis for a general consumer.",
    Diabetic: "Focus heavily on glycemic index, hidden sugars (maltodextrin, syrups), and refined carbs. Be extra critical of sugar content.",
    Kids: "Focus on artificial colors, preservatives, high sugar, and caffeine. Use parent-friendly language.",
    Gym: "Focus on protein quality, protein-to-sugar ratio, and filler ingredients. Highlight satiety and muscle-building support."
  };

  const prompt = `
    Analyze this packaged food/beverage ingredient label image.
    
    Current Mode: ${mode}
    Mode Focus: ${modeInstructions[mode]}
    
    Special Instructions for Indian Labels:
    - Be aware of FSSAI-style labeling.
    - Interpret INS codes (e.g., INS 211 is Sodium Benzoate).
    - Handle terms like "nature identical flavoring substances" and "class II preservatives".
    - Be critical of "Palm Oil" and "Vanaspati" common in Indian snacks.
    - CRITICAL RULE: If total sugar content is around or more than 50% of the product weight (e.g., 50g per 100g), the verdict_action MUST be "Avoid" regardless of other positive factors.
    
    1. Extract all text (OCR).
    2. Identify ingredients, additives, preservatives, sweeteners, allergens.
    3. Calculate a health score (0-100) and ingredient risk score.
    4. Provide a verdict (Good, Moderate, Bad) and a clear action (Good Choice, Not Ideal, Avoid).
    - Good Choice: Suitable for regular use.
    - Not Ideal: Better consumed occasionally.
    - Avoid: Avoid for regular consumption.
    5. List the Top 3 reasons for this verdict.
    6. Provide a scoring breakdown (e.g., "Sugar impact: -15").
    7. Determine confidence level (High, Moderate, Low) and explain why (e.g., "OCR clear", "90% ingredients matched").
    8. Evaluate suitability for various groups (Children, Diabetics, etc.).
    9. For each ingredient, provide a risk level (Low, Medium, High) and source tag (confirmed, estimated, low_confidence).
    10. Identify processing level (e.g., "Ultra-processed").
    11. Provide "Better Alternatives Guidance" - what should the user look for instead if this is bad?
    12. CRITICAL: For nutrition values, use ONLY simple standard units: "g" for grams, "mg" for milligrams, "kcal" for calories, or "ml" for milliliters. DO NOT use complex units like "g per ml", "mg per 100ml", "mlg", "gg", or other non-standard abbreviations. Ensure there is a space between the number and the unit (e.g., "10 g", "500 mg").
    13. Do not provide medical diagnosis.
    14. Use consumer-friendly language.
    15. Return the result in the specified JSON format.
  `;

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
}
