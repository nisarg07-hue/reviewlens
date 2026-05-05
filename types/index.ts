// ─── Platform types ───────────────────────────────────────────────────────────

export type Platform = "amazon" | "g2" | "trustpilot" | "appstore" | "google" | "yelp";

export interface DetectedPlatform {
  platform: Platform;
  identifier: string; // ASIN, slug, business ID, etc.
  displayName: string;
}

// ─── Raw review data ──────────────────────────────────────────────────────────

export interface RawReview {
  id: string;
  rating: number; // 1-5
  title?: string;
  body: string;
  date: string;
  author?: string;
  verified?: boolean;
}

export interface ScrapeResult {
  platform: Platform;
  productName: string;
  productUrl: string;
  totalReviews: number;
  averageRating: number;
  reviews: RawReview[];
  error?: string;
}

// ─── AI analysis output ───────────────────────────────────────────────────────

export interface PainPoint {
  theme: string;
  description: string;
  frequency: "very common" | "common" | "occasional";
  severity: "critical" | "moderate" | "minor";
  exampleQuotes: string[];
}

export interface Praise {
  theme: string;
  description: string;
  frequency: "very common" | "common" | "occasional";
  exampleQuotes: string[];
}

export interface SentimentBreakdown {
  positive: number; // percentage
  neutral: number;
  negative: number;
  starDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface Improvement {
  priority: "high" | "medium" | "low";
  title: string;
  rationale: string;
  estimatedImpact: string;
}

export interface AnalysisReport {
  id: string;
  createdAt: string;
  productName: string;
  productUrl: string;
  platform: Platform;
  totalReviewsAnalyzed: number;
  averageRating: number;
  overallSummary: string;
  sentiment: SentimentBreakdown;
  painPoints: PainPoint[];
  praises: Praise[];
  improvements: Improvement[];
  competitorGap?: string; // "Customers repeatedly mention switching from X"
  toneSignal: "very positive" | "mixed positive" | "neutral" | "mixed negative" | "very negative";
}

// ─── API request / response shapes ───────────────────────────────────────────

export interface AnalyzeRequest {
  url: string;
}

export interface AnalyzeResponse {
  success: boolean;
  report?: AnalysisReport;
  error?: string;
}

export interface ComparisonReport {
  id: string;
  createdAt: string;
  productA: {
    name: string;
    url: string;
    platform: Platform;
    averageRating: number;
    totalReviewsAnalyzed: number;
    strengths: string[];
    weaknesses: string[];
  };
  productB: {
    name: string;
    url: string;
    platform: Platform;
    averageRating: number;
    totalReviewsAnalyzed: number;
    strengths: string[];
    weaknesses: string[];
  };
  executiveSummary: string;
  winner: "Product A" | "Product B" | "Tie";
  winRationale: string;
  featureComparison: {
    feature: string;
    winner: "Product A" | "Product B" | "Tie";
    rationale: string;
  }[];
}

export interface CompareRequest {
  urlA: string;
  urlB: string;
}

export interface CompareResponse {
  success: boolean;
  report?: ComparisonReport;
  error?: string;
}

// ─── Supabase DB row shapes ───────────────────────────────────────────────────

export interface DbReport {
  id: string;
  created_at: string;
  user_id: string | null;
  url: string;
  platform: Platform;
  product_name: string;
  report_json: AnalysisReport;
  is_public: boolean;
}

export interface DbUser {
  id: string;
  email: string;
  plan: "free" | "pro" | "agency";
  reports_this_month: number;
  stripe_customer_id: string | null;
}
