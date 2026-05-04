export type ExamPart = "part1" | "part2" | "part3";

export interface DimensionScore {
  score: number;
  evidence: string;
  explanation: string;
}

export interface EvaluationResult {
  fluency: DimensionScore;
  lexical_resource: DimensionScore;
  naturalness: DimensionScore;
}

export interface ErrorHighlight {
  text: string;
  type: string;
  suggestion: string;
}

export interface RewriteSuggestion {
  original: string;
  improved: string;
  reason: string;
}

export interface FeedbackResult {
  error_highlights: ErrorHighlight[];
  rewrites: RewriteSuggestion[];
  summary: string;
}

export interface Message {
  role: "user" | "examiner";
  content: string;
  evaluation?: EvaluationResult;
  feedback?: FeedbackResult;
}

export interface StartResponse {
  session_id: string;
  part: ExamPart;
  topic: string;
  examiner_message: string;
}

export interface RespondResponse {
  examiner_message: string;
  evaluation: EvaluationResult;
  feedback: FeedbackResult;
}

export interface ProgressPoint {
  date: string;
  avg_fluency: number;
  avg_lexical: number;
  avg_naturalness: number;
}

export interface WeaknessItem {
  dimension: string;
  avg_score: number;
  advice: string;
}
