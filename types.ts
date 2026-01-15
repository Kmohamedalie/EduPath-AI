
export interface Topic {
  name: string;
  description: string;
}

export interface SkillRating {
  skill: string;
  level: number; // 1 to 5
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
