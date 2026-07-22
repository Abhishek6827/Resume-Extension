export interface SkillItem {
  name: string;
  category: "Languages" | "Frameworks" | "Databases" | "ToolsAndCloud" | "Methodologies";
  versionDetails?: string;
  sourceRepo: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
}

export interface ProjectExperience {
  name: string;
  repoUrl: string;
  description: string;
  topics: string[];
  extractedSkills: string[];
  primaryLanguage: string;
  stars: number;
  updatedAt: string;
}

export interface SkillBank {
  username: string;
  scannedAt: string;
  skills: SkillItem[];
  projects: ProjectExperience[];
  categorized: {
    Languages: string[];
    Frameworks: string[];
    Databases: string[];
    ToolsAndCloud: string[];
    Methodologies: string[];
  };
}

export interface JDMatchResult {
  matchedKeywords: {
    skill: string;
    category: string;
    evidence: string;
    sourceRepo: string;
  }[];
  missingGaps: string[];
  relevantProjects: ProjectExperience[];
  matchScore: number;
}

/**
  Categorizes a skill string into one of the 5 main categories.
 */
export function categorizeSkill(skillName: string): SkillItem["category"] {
  const lower = skillName.toLowerCase();

  const languages = ["typescript", "javascript", "python", "java", "c++", "cpp", "c#", "c", "go", "golang", "rust", "ruby", "php", "swift", "kotlin", "scala", "html", "css", "sql", "r", "shell", "bash"];
  if (languages.some(l => lower.includes(l))) return "Languages";

  const databases = ["postgres", "postgresql", "mysql", "mongodb", "mongo", "redis", "dynamodb", "sqlite", "oracle", "elasticsearch", "cassandra", "supabase", "firebase", "prisma", "sequelize"];
  if (databases.some(d => lower.includes(d))) return "Databases";

  const frameworks = ["react", "next.js", "nextjs", "vue", "angular", "express", "node.js", "nodejs", "spring", "spring boot", "django", "flask", "fastapi", "nest.js", "nestjs", "laravel", "tailwind", "bootstrap", "flutter", "react native", "tensorflow", "pytorch", "keras", "scikit-learn"];
  if (frameworks.some(f => lower.includes(f))) return "Frameworks";

  const tools = ["docker", "kubernetes", "k8s", "aws", "amazon web services", "azure", "gcp", "google cloud", "git", "github", "gitlab", "jenkins", "github actions", "ci/cd", "terraform", "ansible", "nginx", "webpack", "vite", "babel", "graphql", "rest api", "kafka", "rabbitmq", "linux"];
  if (tools.some(t => lower.includes(t))) return "ToolsAndCloud";

  return "Methodologies";
}

/**
 * Filters out missing keywords that are version variants (e.g. "Java 8", "Java 17", "Java 21", "Python 3")
 * of a skill that is already present in matchedKeywords or candidate's skills.
 */
export function sanitizeMissingKeywords(
  missing: string[],
  matched: string[],
  candidateSkills: string[] = []
): string[] {
  if (!Array.isArray(missing) || missing.length === 0) return [];

  const matchedSet = new Set<string>();
  (matched || []).forEach((m) => matchedSet.add(String(m).toLowerCase().trim()));
  (candidateSkills || []).forEach((s) => matchedSet.add(String(s).toLowerCase().trim()));

  return missing.filter((kw) => {
    if (!kw || typeof kw !== "string") return false;
    const kwLower = kw.toLowerCase().trim();

    // Direct match check
    if (matchedSet.has(kwLower)) return false;

    // Extract base technology name by removing version numbers/suffixes
    // e.g., "Java 8" -> "java", "Java 17" -> "java", "Java 8/17/21" -> "java", "Python 3.8" -> "python"
    const baseTech = kwLower
      .replace(/(\s*v?\d+(\.\d+)*(\/\d+)*\+?)+/g, "")
      .replace(/\s*(8|11|17|21|3|4|5|16|17|18|19|20|21)\b/g, "")
      .trim();

    if (baseTech && baseTech.length >= 2) {
      for (const matchedSkill of Array.from(matchedSet)) {
        const matchedBase = matchedSkill
          .replace(/(\s*v?\d+(\.\d+)*(\/\d+)*\+?)+/g, "")
          .replace(/\s*(8|11|17|21|3|4|5|16|17|18|19|20|21)\b/g, "")
          .trim();

        if (
          matchedBase === baseTech ||
          matchedSkill === baseTech ||
          kwLower.startsWith(matchedSkill + " ") ||
          kwLower.startsWith(matchedBase + " ")
        ) {
          return false; // Filter out: version variant of an already matched skill!
        }
      }
    }

    return true;
  });
}

/**
  Matches a parsed Job Description (keywords/text) against a user's SkillBank.
 */
export function matchSkillBankWithJD(skillBank: SkillBank, jdText: string | any): JDMatchResult {
  const textToScan = typeof jdText === "string" ? jdText : JSON.stringify(jdText);
  const lowerJd = textToScan.toLowerCase();

  const matchedKeywordsMap = new Map<string, JDMatchResult["matchedKeywords"][0]>();
  const missingGapsSet = new Set<string>();

  // Check each skill in candidate's skill bank
  skillBank.skills.forEach((item) => {
    const skillLower = item.name.toLowerCase();
    
    // Alias matching
    const matchesJd =
      lowerJd.includes(skillLower) ||
      (skillLower === "golang" && lowerJd.includes("go")) ||
      (skillLower === "mongo" && lowerJd.includes("mongodb")) ||
      (skillLower === "github" && lowerJd.includes("git"));

    if (matchesJd) {
      const normalizedKey = item.name.toLowerCase();
      if (!matchedKeywordsMap.has(normalizedKey)) {
        matchedKeywordsMap.set(normalizedKey, {
          skill: item.name + (item.versionDetails ? ` (${item.versionDetails})` : ""),
          category: item.category,
          evidence: item.evidence,
          sourceRepo: item.sourceRepo
        });
      }
    }
  });

  const matchedKeywords = Array.from(matchedKeywordsMap.values());

  // Common tech keywords to evaluate missing gaps
  const commonTechList = [
    { name: "Java", aliases: ["java"] },
    { name: "Go", aliases: ["go", "golang"] },
    { name: "MongoDB", aliases: ["mongodb", "mongo", "mongoose"] },
    { name: "REST API", aliases: ["rest api", "restful", "express", "spring"] },
    { name: "Git", aliases: ["git", "github", "gitlab"] },
    { name: "Microservices", aliases: ["microservices", "microservice", "spring boot", "docker"] },
    { name: "TypeScript", aliases: ["typescript", "ts"] },
    { name: "JavaScript", aliases: ["javascript", "js"] },
    { name: "Python", aliases: ["python", "py"] },
    { name: "React", aliases: ["react"] },
    { name: "Node.js", aliases: ["node.js", "nodejs", "node"] },
    { name: "PostgreSQL", aliases: ["postgresql", "postgres"] },
    { name: "Docker", aliases: ["docker"] },
    { name: "Kubernetes", aliases: ["kubernetes", "k8s"] },
    { name: "AWS", aliases: ["aws", "amazon web services"] }
  ];

  commonTechList.forEach((tech) => {
    const jdRequiresTech = tech.aliases.some(alias => lowerJd.includes(alias));
    if (jdRequiresTech) {
      const candidateHasTech = skillBank.skills.some(s =>
        tech.aliases.some(alias => s.name.toLowerCase().includes(alias))
      );
      if (!candidateHasTech) {
        missingGapsSet.add(tech.name);
      }
    }
  });

  // Find relevant projects that contain matched skills
  const relevantProjects = skillBank.projects.filter((p) => {
    return p.extractedSkills.some(skill => lowerJd.includes(skill.toLowerCase())) ||
      (p.description && lowerJd.includes(p.name.toLowerCase()));
  });

  const matchedNames = matchedKeywords.map((m) => m.skill);
  const candidateSkillNames = skillBank.skills.map((s) => s.name);
  const missingGaps = sanitizeMissingKeywords(Array.from(missingGapsSet), matchedNames, candidateSkillNames);

  const totalKeywordsFound = matchedKeywords.length;
  const totalKeywordsInJd = totalKeywordsFound + missingGaps.length;
  const matchScore = totalKeywordsInJd > 0 ? Math.round((totalKeywordsFound / totalKeywordsInJd) * 100) : 100;

  return {
    matchedKeywords,
    missingGaps,
    relevantProjects,
    matchScore
  };
}

