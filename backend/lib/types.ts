// ─── Resume Tailor — Shared TypeScript Interfaces ──────────────

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  website: string;
  location: string;
}

export interface ExperienceEntry {
  role: string;
  company: string;
  duration: string;
  location: string;
  highlights: string[];
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year: string;
  gpa?: string;
}

export interface ProjectEntry {
  name: string;
  description: string;
  tech: string[];
  highlights: string[];
}

export interface SkillsData {
  languages: string[];
  frameworks: string[];
  tools: string[];
  other: string[];
}

export interface ResumeData {
  name: string;
  title: string;
  contact: ContactInfo;
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skills: SkillsData;
  certifications: string[];
  projects: ProjectEntry[];
  achievements: string[];
}

export interface JDData {
  jobTitle: string;
  company: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  responsibilities: string[];
  keywords: string[];
}

export interface TailoredChange {
  id: string;
  section: string;       // e.g. "summary", "experience", "projects", "skills", "title"
  field: string;         // e.g. "summary", "experience[0].highlights[1]", "skills.languages"
  label: string;         // Human-readable label e.g. "Professional Summary", "Bullet #2 at CHINTU AI"
  originalValue: string;
  newValue: string;
  status: "pending" | "approved" | "rejected";
}

export interface TailoredResult {
  tailoredResume: ResumeData;
  changes: TailoredChange[];
  atsScore: number;
  scoreReasoning: string;
  matchedKeywords: string[];
  missingKeywords: string[];
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
}
