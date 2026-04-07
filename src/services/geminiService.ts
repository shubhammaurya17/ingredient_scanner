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
