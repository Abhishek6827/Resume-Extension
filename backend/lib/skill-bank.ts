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
  const lower = skillName.toLowerCase().trim();

  // 1. Frameworks & Libraries
  const frameworks = [
    "django rest framework", "django", "drf", "fastapi", "flask", "spring boot", "spring",
    "react native", "react", "next.js", "nextjs", "vue", "angular", "express.js", "express",
    "node.js", "nodejs", "nest.js", "nestjs", "laravel", "tailwind css", "tailwind", "tailwindcss",
    "bootstrap", "flutter", "tensorflow", "pytorch", "keras", "scikit-learn", "redux", "graphql", "apollo",
    "framer motion", "zustand", "react query", "vite", "webpack"
  ];
  if (frameworks.some(f => lower === f || lower.includes(f))) return "Frameworks";

  // 2. Databases & ORMs
  const databases = [
    "postgres", "postgresql", "mysql", "mongodb", "mongo", "redis", "dynamodb",
    "sqlite", "sqlite3", "oracle", "elasticsearch", "cassandra", "supabase", "firebase", "prisma", "prisma orm", "sequelize", "sqlalchemy"
  ];
  if (databases.some(d => lower === d || lower.includes(d))) return "Databases";

  // 3. Tools, Cloud & DevOps
  const tools = [
    "docker", "kubernetes", "k8s", "aws", "amazon web services", "azure", "gcp", "google cloud",
    "git", "github", "gitlab", "jenkins", "github actions", "ci/cd", "terraform", "ansible",
    "nginx", "babel", "rest api", "restful", "kafka", "rabbitmq", "linux", "electron", "capacitor",
    "mobile app", "jest", "cypress", "ai integration"
  ];
  if (tools.some(t => lower === t || lower.includes(t))) return "ToolsAndCloud";

  // 4. Languages
  const multiCharLanguages = [
    "typescript", "javascript", "python", "java", "golang",
    "rust", "ruby", "php", "swift", "kotlin", "scala", "html", "css", "scss", "sass", "sql", "shell", "bash"
  ];
  if (multiCharLanguages.some(l => lower === l || lower.includes(l))) return "Languages";

  if (["c", "c++", "cpp", "c#", "r", "go", "tex"].includes(lower)) return "Languages";

  return "Methodologies";
}

// Set of generic non-technical descriptors and soft skills that should not be flagged as missing ATS keywords
const GENERIC_SOFT_QUALITIES = new Set([
  "accuracy",
  "clarity",
  "code decisions",
  "technical reasoning",
  "solution approaches",
  "software defects",
  "performance bottlenecks",
  "maintainability",
  "scalability",
  "problem solving",
  "critical thinking",
  "collaboration",
  "communication",
  "leadership",
  "attention to detail",
  "agile methodology",
  "team player"
]);

/**
 * Filters out missing keywords that are:
 * 1. Version variants (e.g. "Java 8", "Java 17", "Java 21", "Python 3") of an already matched skill.
 * 2. Generic non-technical descriptors or soft qualities that are inherent to standard engineering work.
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

    // 1. Direct match check
    if (matchedSet.has(kwLower)) return false;

    // 2. Filter out generic soft traits
    if (GENERIC_SOFT_QUALITIES.has(kwLower)) return false;

    // 3. Extract base technology name by removing version numbers/suffixes
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

function matchesKeyword(text: string, kw: string): boolean {
  if (!text || !kw || kw.trim().length < 2) return false;
  const lowerText = text.toLowerCase();
  const lowerKw = kw.toLowerCase().trim();

  if (lowerKw === "c++" || lowerKw === "c#" || lowerKw === ".net") {
    const escaped = lowerKw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[\\s/,()])${escaped}(?:$|[\\s/,()])`, "i").test(lowerText);
  }

  const escaped = lowerKw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(lowerText);
}

/**
  Matches a parsed Job Description (keywords/text) against a user's SkillBank.
 */
export function matchSkillBankWithJD(skillBank: SkillBank, jdText: string | any): JDMatchResult {
  const textToScan = typeof jdText === "string" ? jdText : JSON.stringify(jdText);
  const lowerJd = textToScan.toLowerCase();

  const matchedKeywordsMap = new Map<string, JDMatchResult["matchedKeywords"][0]>();
  const missingGapsSet = new Set<string>();

  // Check each skill in candidate's skill bank with word boundary matching
  skillBank.skills.forEach((item) => {
    const skillLower = item.name.toLowerCase().trim();
    if (!skillLower || skillLower.length < 2) return;
    
    // Alias / boundary matching
    const matchesJd =
      matchesKeyword(lowerJd, skillLower) ||
      (skillLower === "golang" && matchesKeyword(lowerJd, "go")) ||
      (skillLower === "mongo" && matchesKeyword(lowerJd, "mongodb")) ||
      (skillLower === "github" && matchesKeyword(lowerJd, "git")) ||
      (skillLower === "django" && (matchesKeyword(lowerJd, "django") || matchesKeyword(lowerJd, "drf"))) ||
      (skillLower === "django rest framework" && (matchesKeyword(lowerJd, "django") || matchesKeyword(lowerJd, "drf") || lowerJd.includes("rest framework")));

    if (matchesJd) {
      const normalizedKey = skillLower;
      const existing = matchedKeywordsMap.get(normalizedKey);
      if (!existing) {
        matchedKeywordsMap.set(normalizedKey, {
          skill: item.name + (item.versionDetails ? ` (${item.versionDetails})` : ""),
          category: item.category,
          evidence: item.evidence,
          sourceRepo: item.sourceRepo
        });
      } else {
        // If existing is a portfolio or account-level repo, prefer the actual implementation project repo (e.g. Kanban_WorkBoard)
        if (
          (existing.sourceRepo.toLowerCase().includes("portfolio") || existing.sourceRepo.toLowerCase().includes("account")) &&
          !item.sourceRepo.toLowerCase().includes("portfolio") &&
          !item.sourceRepo.toLowerCase().includes("account")
        ) {
          existing.sourceRepo = item.sourceRepo;
          existing.evidence = item.evidence;
        }
      }
    }
  });

  const matchedKeywords = Array.from(matchedKeywordsMap.values());

  // Common tech keywords to evaluate missing gaps
  const commonTechList = [
    { name: "Django", aliases: ["django", "drf", "django rest framework"] },
    { name: "Django REST Framework", aliases: ["django rest framework", "drf", "djangorestframework"] },
    { name: "FastAPI", aliases: ["fastapi"] },
    { name: "Flask", aliases: ["flask"] },
    { name: "React", aliases: ["react", "react.js", "reactjs"] },
    { name: "Next.js", aliases: ["next.js", "nextjs", "next"] },
    { name: "Tailwind CSS", aliases: ["tailwind css", "tailwind", "tailwindcss"] },
    { name: "Java", aliases: ["java"] },
    { name: "Spring Boot", aliases: ["spring boot", "spring-boot", "spring"] },
    { name: "Go", aliases: ["go", "golang"] },
    { name: "MongoDB", aliases: ["mongodb", "mongo", "mongoose"] },
    { name: "PostgreSQL", aliases: ["postgresql", "postgres"] },
    { name: "Redis", aliases: ["redis", "ioredis"] },
    { name: "REST API", aliases: ["rest api", "restful", "express", "spring", "fastapi"] },
    { name: "GraphQL", aliases: ["graphql", "apollo"] },
    { name: "Git", aliases: ["git", "github", "gitlab"] },
    { name: "Microservices", aliases: ["microservices", "microservice", "spring boot", "docker"] },
    { name: "TypeScript", aliases: ["typescript", "ts"] },
    { name: "JavaScript", aliases: ["javascript", "js"] },
    { name: "Python", aliases: ["python", "py"] },
    { name: "Node.js", aliases: ["node.js", "nodejs", "node"] },
    { name: "Docker", aliases: ["docker"] },
    { name: "Kubernetes", aliases: ["kubernetes", "k8s"] },
    { name: "AWS", aliases: ["aws", "amazon web services"] }
  ];

  commonTechList.forEach((tech) => {
    const jdRequiresTech = tech.aliases.some(alias => matchesKeyword(lowerJd, alias));
    if (jdRequiresTech) {
      const candidateHasTech = skillBank.skills.some(s =>
        tech.aliases.some(alias => matchesKeyword(s.name.toLowerCase(), alias))
      );
      if (!candidateHasTech) {
        missingGapsSet.add(tech.name);
      }
    }
  });

  // Score and rank relevant projects by relevance to JD
  const scoredProjects = (skillBank.projects || []).map((proj) => {
    let score = 0;
    const pSkills = proj.extractedSkills || [];

    pSkills.forEach((skill) => {
      if (matchesKeyword(lowerJd, skill)) {
        score += 10;
      }
    });

    if (proj.primaryLanguage && matchesKeyword(lowerJd, proj.primaryLanguage)) {
      score += 15;
    }

    if (proj.description && (matchesKeyword(lowerJd, "django") && proj.description.toLowerCase().includes("django"))) {
      score += 20;
    }

    if (proj.name && matchesKeyword(lowerJd, proj.name)) {
      score += 5;
    }

    return { project: proj, score };
  });

  const relevantProjects = scoredProjects
    .filter(sp => sp.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(sp => sp.project);

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

