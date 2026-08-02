import type { AnalysisResult } from "../shared/types.js";

export interface SemanticAnalysisInput {
  productName: string;
  brand?: string;
  category?: string;
  attributes?: Record<string, string | number | boolean>;
  targetKeywords?: string[];
  prohibitedKeywords?: string[];
  competitorNames?: string[];
}

export interface SemanticEntities {
  brand?: string;
  productType?: string;
  functions: string[];
  targetUsers: string[];
  useCases: string[];
  technologies: string[];
  specifications: string[];
  modifiers: string[];
}

export interface SemanticAnalysisDetails {
  entities: SemanticEntities;

  matchedKeywords: string[];
  missingKeywords: string[];
  duplicatedTerms: string[];
  suspiciousTerms: string[];

  categoryAlignmentScore: number;
  clarityScore: number;
  keywordBalanceScore: number;
  readabilityScore: number;
}

export type SemanticAnalysisResult = AnalysisResult<SemanticAnalysisDetails>;

export interface ProductNameSuggestion {
  productName: string;
  rationale: string;
  addedKeywords: string[];
}

export interface SuggestionOptions {
  maxSuggestions?: number;
  maxLength?: number;
}
