
export interface Topic {
  name: string;
  description: string;
}

export interface SkillRating {
  skill: string;
  level: number; // 1 to 5
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Module {
  id: string;
  title: string;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  topics: Topic[];
  learningOutcomes: string[];
  industryAlignment: string;
  academicAlignment: string;
  isCompleted?: boolean;
}

export interface Curriculum {
  specialization: string;
  overview: string;
  totalDuration: string;
  targetRole: string;
  modules: Module[];
  suggestedCertifications: string[];
  prerequisites: string[];
  adaptiveFocusReasoning?: string;
  industryRelevanceScore: number; // 0 to 100
  groundingSources?: GroundingSource[];
  timestamp?: number;
}

export type ExperienceLevel = 'Beginner' | 'Professional' | 'Academic';

export interface GenerationState {
  isLoading: boolean;
  error: string | null;
  curriculum: Curriculum | null;
}

export interface UserProfile {
  email: string;
  skills: SkillRating[];
  savedPaths: Curriculum[];
  memberSince: string;
}
