export type Verdict = 'Good' | 'Moderate' | 'Bad';
export type VerdictAction = 'Good Choice' | 'Not Ideal' | 'Avoid';
export type SuitabilityStatus = 'Suitable' | 'Caution' | 'Avoid';
export type ConfidenceLevel = 'High' | 'Moderate' | 'Low';
export type AnalysisMode = 'General' | 'Diabetic' | 'Kids' | 'Gym';

export interface IngredientBreakdown {
  name: string;
  simple_name: string;
  category: string;
  what_it_is: string;
  why_used: string;
  possible_benefits: string[];
  possible_risks: string[];
  estimated_quantity_note: string;
  confidence: number;
  source_type: 'confirmed' | 'estimated' | 'low_confidence';
  risk_level: 'Low' | 'Medium' | 'High';
}

export interface SuitabilityFlag {
  group: string;
  status: SuitabilityStatus;
  reason: string;
  confidence: number;
}

export interface ScoreImpact {
  factor: string;
  impact: number;
}

export interface ScanResult {
  id?: string;
  product_name: string;
  ocr_confidence: number;
  analysis_confidence: number;
  confidence_level: ConfidenceLevel;
  confidence_reasons: string[];
  overall_verdict: Verdict;
  verdict_action: VerdictAction;
  health_score: number;
  ingredient_risk_score: number;
  why_summary: string;
  top_reasons: string[];
  score_breakdown: ScoreImpact[];
  confirmed_facts: string[];
  ai_estimates: string[];
  nutrition_summary: {
    sugar: { value: string; level: 'Low' | 'Moderate' | 'High' };
    sodium: { value: string; level: 'Low' | 'Moderate' | 'High' };
    protein: { value: string; level: 'Low' | 'Moderate' | 'High' };
    fiber: { value: string; level: 'Low' | 'Moderate' | 'High' };
    saturated_fat: { value: string; level: 'Low' | 'Moderate' | 'High' };
  };
  ingredient_breakdown: IngredientBreakdown[];
  suitability_flags: SuitabilityFlag[];
  allergen_flags: string[];
  warnings: string[];
  raw_ocr_text: string;
  imageUrl: string;
  placeholderUrl?: string;
  userId: string;
  createdAt: any;
  processing_level: string;
  mode?: AnalysisMode;
  isFavorite?: boolean;
  collectionId?: string;
  better_alternatives_guidance?: string;
}

export interface Collection {
  id: string;
  name: string;
  userId: string;
  createdAt: any;
}

export interface UserProfile {
  uid: string;
  email?: string;
  phoneNumber?: string;
  displayName?: string;
  photoURL?: string;
  createdAt: any;
  dietaryPreferences?: string[];
  preferredMode?: AnalysisMode;
}
