import type { AnalysisResult } from "../shared/types.js";

export interface ContentQualityInput {
  html?: string;
  plainText?: string;
  productName?: string;
  category?: string;
  attributes?: Record<string, string | number | boolean>;
  targetKeywords?: string[];
}

export type ContentSectionKey =
  | "introduction"
  | "features"
  | "specifications"
  | "usageGuide"
  | "packageContents"
  | "precautions"
  | "faq"
  | "targetUsers"
  | "useCases";

export interface ContentQualityDetails {
  textLength: number;
  wordCount: number;
  headingCount: number;
  imageCount: number;
  imagesWithAlt: number;

  sections: Record<ContentSectionKey, boolean>;

  readabilityScore: number;
  structureScore: number;
  completenessScore: number;
  keywordCoverageScore: number;
  titleContentConsistencyScore: number;
  imageTextBalanceScore: number;

  repeatedKeywords: Array<{
    keyword: string;
    count: number;
    density: number;
  }>;

  missingSections: string[];
}

export type ContentQualityResult = AnalysisResult<ContentQualityDetails>;
