import { SkillBank, SkillItem, ProjectExperience, categorizeSkill } from "./skill-bank";

interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  topics?: string[];
  default_branch: string;
}

interface TreeItem {
  path: string;
  type: string;
  url?: string;
}

interface TechPattern {
  name: string;
  pattern: RegExp;
  extraSkills?: string[];
}

const TECH_PATTERNS: TechPattern[] = [
  { name: "Django REST Framework", pattern: /\b(django[\s-_]*rest[\s-_]*framework|drf)\b/i, extraSkills: ["Django", "REST API"] },
  { name: "Django", pattern: /\bdjango\b/i, extraSkills: ["Python"] },
  { name: "FastAPI", pattern: /\bfastapi\b/i, extraSkills: ["Python", "REST API"] },
  { name: "Flask", pattern: /\bflask\b/i, extraSkills: ["Python"] },
  { name: "Next.js", pattern: /\b(next\.js|nextjs)\b/i, extraSkills: ["React"] },
  { name: "React Native", pattern: /\breact[\s-_]*native\b/i, extraSkills: ["React", "Mobile App"] },
  { name: "React", pattern: /\b(react(\.js|js)?)\b/i },
  { name: "Vue.js", pattern: /\b(vue(\.js|js)?)\b/i },
  { name: "Angular", pattern: /\bangular\b/i },
  { name: "Spring Boot", pattern: /\bspring[\s-_]*boot\b/i, extraSkills: ["Java", "REST API", "Microservices"] },
  { name: "Spring", pattern: /\bspring([\s-_]*framework)?\b/i, extraSkills: ["Java"] },
  { name: "Express.js", pattern: /\b(express(\.js|js)?)\b/i, extraSkills: ["Node.js", "REST API"] },
  { name: "Node.js", pattern: /\b(node\.js|nodejs)\b/i },
  { name: "Tailwind CSS", pattern: /\btailwind([\s-_]*css)?\b/i },
  { name: "TypeScript", pattern: /\b(typescript|ts)\b/i },
  { name: "JavaScript", pattern: /\b(javascript|js)\b/i },
  { name: "Python", pattern: /\bpython\b/i },
  { name: "Java", pattern: /\bjava\b/i },
  { name: "Go", pattern: /\b(golang|go[\s-_]*lang)\b/i },
  { name: "Rust", pattern: /\brust(lang)?\b/i },
  { name: "PostgreSQL", pattern: /\b(postgres|postgresql)\b/i },
  { name: "MongoDB", pattern: /\b(mongodb|mongo|mongoose)\b/i },
  { name: "Redis", pattern: /\bredis\b/i },
  { name: "MySQL", pattern: /\bmysql\b/i },
  { name: "SQLite", pattern: /\bsqlite(3)?\b/i },
  { name: "Prisma ORM", pattern: /\bprisma\b/i },
  { name: "Docker", pattern: /\bdocker\b/i },
  { name: "Kubernetes", pattern: /\b(kubernetes|k8s)\b/i },
  { name: "AWS", pattern: /\b(aws|amazon[\s-_]*web[\s-_]*services)\b/i },
  { name: "Azure", pattern: /\bazure\b/i },
  { name: "GCP", pattern: /\b(gcp|google[\s-_]*cloud)\b/i },
  { name: "GraphQL", pattern: /\bgraphql\b/i },
  { name: "REST API", pattern: /\b(rest(\s*api|ful))\b/i },
  { name: "Microservices", pattern: /\bmicroservices?\b/i },
  { name: "Kafka", pattern: /\bkafka\b/i },
  { name: "Vite", pattern: /\bvite\b/i },
  { name: "Redux", pattern: /\bredux\b/i },
  { name: "Electron", pattern: /\belectron\b/i },
  { name: "Capacitor", pattern: /\bcapacitor\b/i },
  { name: "Firebase", pattern: /\bfirebase\b/i },
  { name: "Supabase", pattern: /\bsupabase\b/i },
  { name: "TensorFlow", pattern: /\btensorflow\b/i, extraSkills: ["Python"] },
  { name: "PyTorch", pattern: /\b(pytorch|torch)\b/i, extraSkills: ["Python"] },
  { name: "Pandas", pattern: /\bpandas\b/i, extraSkills: ["Python"] },
  { name: "Scikit-Learn", pattern: /\b(scikit-learn|sklearn)\b/i, extraSkills: ["Python"] },
  { name: "CI/CD", pattern: /\b(ci[\s/]*cd|github[\s-_]*actions)\b/i },
];

const NOISE_SKILLS = new Set([
  "fs.stat", "procfile", "clsx", "class-variance-authority", "tailwind-merge", "tslib",
  "date-fns", "dayjs", "moment", "cors", "dotenv", "resolvers", "hookform/resolvers",
  "react-hook-form", "react-dialog", "react-accordion", "react-tabs", "react-icons",
  "cheerio", "file-opener", "common", "jest-dom", "user-event", "web-vitals",
  "cookie-parser", "body-parser", "cross-env", "nodemon", "concurrently", "rimraf",
  "path", "fs", "os", "crypto", "buffer", "stream", "util", "events", "url", "http", "https",
  "ava", "types", "app", "debug", "affine", "annotated-doc", "annotated-types", "anyio",
  "asgiref", "attrs", "blinker", "certifi", "click", "click-plugins", "cligj", "colorama",
  "dj-database-url", "h11", "idna", "imageio", "itsdangerous", "jinja2", "lazy_loader",
  "markupsafe", "networkx", "packaging", "pyparsing", "pyproj", "python-dotenv",
  "python-multipart", "rasterio", "setuptools", "sniffio", "sqlparse", "starlette",
  "tifffile", "typing-inspection", "typing_extensions", "tzdata", "werkzeug", "wheel", "whitenoise"
]);

const NPM_MAPPINGS: Record<string, { name: string; extra?: string[] }> = {
  "react": { name: "React" },
  "react-dom": { name: "React" },
  "react-native": { name: "React Native", extra: ["React", "Mobile App"] },
  "next": { name: "Next.js", extra: ["React"] },
  "express": { name: "Express.js", extra: ["Node.js", "REST API"] },
  "tailwindcss": { name: "Tailwind CSS" },
  "typescript": { name: "TypeScript" },
  "prisma": { name: "Prisma ORM" },
  "@prisma/client": { name: "Prisma ORM" },
  "mongoose": { name: "MongoDB" },
  "mongodb": { name: "MongoDB" },
  "pg": { name: "PostgreSQL" },
  "postgres": { name: "PostgreSQL" },
  "redis": { name: "Redis" },
  "ioredis": { name: "Redis" },
  "firebase": { name: "Firebase" },
  "firebase-admin": { name: "Firebase" },
  "@supabase/supabase-js": { name: "Supabase" },
  "graphql": { name: "GraphQL" },
  "@apollo/client": { name: "GraphQL" },
  "apollo-server": { name: "GraphQL", extra: ["REST API"] },
  "socket.io": { name: "Socket.io" },
  "socket.io-client": { name: "Socket.io" },
  "@reduxjs/toolkit": { name: "Redux" },
  "redux": { name: "Redux" },
  "react-redux": { name: "Redux", extra: ["React"] },
  "zustand": { name: "Zustand" },
  "@tanstack/react-query": { name: "React Query", extra: ["React"] },
  "react-query": { name: "React Query", extra: ["React"] },
  "framer-motion": { name: "Framer Motion" },
  "axios": { name: "Axios", extra: ["REST API"] },
  "vite": { name: "Vite" },
  "vue": { name: "Vue.js" },
  "@angular/core": { name: "Angular" },
  "electron": { name: "Electron" },
  "@capacitor/core": { name: "Capacitor" },
  "jest": { name: "Jest" },
  "cypress": { name: "Cypress" },
  "lucide-react": { name: "Lucide Icons" },
  "openai": { name: "OpenAI API", extra: ["AI Integration"] },
  "@google/generative-ai": { name: "Google Gemini AI", extra: ["AI Integration"] },
  "groq-sdk": { name: "Groq SDK", extra: ["AI Integration"] },
};

const PYTHON_MAPPINGS: Record<string, { name: string; extra?: string[] }> = {
  "django": { name: "Django", extra: ["Python", "REST API"] },
  "djangorestframework": { name: "Django REST Framework", extra: ["Django", "Python", "REST API"] },
  "djangorestframework-simplejwt": { name: "Django REST Framework", extra: ["Django", "REST API", "JWT"] },
  "djangorestframework_simplejwt": { name: "Django REST Framework", extra: ["Django", "REST API", "JWT"] },
  "django-cors-headers": { name: "Django" },
  "django-filter": { name: "Django" },
  "django-environ": { name: "Django" },
  "django-crispy-forms": { name: "Django" },
  "flask": { name: "Flask", extra: ["Python", "REST API"] },
  "flask-cors": { name: "Flask" },
  "flask-sqlalchemy": { name: "Flask", extra: ["SQLAlchemy"] },
  "flask-restful": { name: "Flask", extra: ["REST API"] },
  "fastapi": { name: "FastAPI", extra: ["Python", "REST API"] },
  "uvicorn": { name: "Uvicorn" },
  "gunicorn": { name: "Gunicorn" },
  "celery": { name: "Celery" },
  "sqlalchemy": { name: "SQLAlchemy" },
  "psycopg2": { name: "PostgreSQL", extra: ["Python"] },
  "psycopg2-binary": { name: "PostgreSQL", extra: ["Python"] },
  "asyncpg": { name: "PostgreSQL" },
  "pymongo": { name: "MongoDB" },
  "djongo": { name: "MongoDB", extra: ["Django"] },
  "django-mongodb-engine": { name: "MongoDB", extra: ["Django"] },
  "motor": { name: "MongoDB" },
  "redis": { name: "Redis" },
  "pytest": { name: "Pytest" },
  "pandas": { name: "Pandas", extra: ["Python"] },
  "numpy": { name: "NumPy", extra: ["Python"] },
  "scipy": { name: "SciPy", extra: ["Python"] },
  "scikit-learn": { name: "Scikit-Learn", extra: ["Python"] },
  "scikit-image": { name: "Scikit-Image", extra: ["Python"] },
  "sklearn": { name: "Scikit-Learn", extra: ["Python"] },
  "tensorflow": { name: "TensorFlow", extra: ["Python"] },
  "keras": { name: "TensorFlow", extra: ["Python"] },
  "torch": { name: "PyTorch", extra: ["Python"] },
  "pytorch": { name: "PyTorch", extra: ["Python"] },
  "boto3": { name: "AWS", extra: ["Python"] },
  "requests": { name: "REST API", extra: ["Python"] },
  "pydantic": { name: "Pydantic", extra: ["Python"] },
  "pyjwt": { name: "JWT", extra: ["Python"] },
};

function prioritizeSkills(skills: string[]): string[] {
  const getWeight = (skill: string): number => {
    const cat = categorizeSkill(skill);
    const lower = skill.toLowerCase();

    // Low priority markup / generic styling
    if (lower === "html" || lower === "css" || lower === "scss" || lower === "sass" || lower === "tex") return 50;
    if (lower === "shell" || lower === "bash") return 45;

    // Frameworks & Major Backends get top priority
    if (cat === "Frameworks") return 10;
    if (cat === "Databases") return 15;
    if (cat === "Languages") return 20;
    if (cat === "ToolsAndCloud") return 25;
    return 30;
  };

  return Array.from(new Set(skills)).sort((a, b) => {
    const weightA = getWeight(a);
    const weightB = getWeight(b);
    if (weightA !== weightB) return weightA - weightB;
    return a.localeCompare(b);
  });
}

export async function scanGithubProfile(options: {
  token?: string;
  username?: string;
}): Promise<SkillBank> {
  const { token, username } = options;

  if (!token && !username) {
    throw new Error("Either a GitHub Personal Access Token or Username must be provided.");
  }

  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Resume-Tailor-Skill-Bank-Scanner"
  };

  if (token) {
    headers["Authorization"] = `token ${token}`;
  }

  // 1. Fetch user repositories (up to 50 repos)
  let reposUrl = "https://api.github.com/user/repos?sort=updated&per_page=50";
  if (!token && username) {
    reposUrl = `https://api.github.com/users/${username}/repos?sort=updated&per_page=50`;
  }

  const reposRes = await fetch(reposUrl, { headers });
  if (!reposRes.ok) {
    const errText = await reposRes.text();
    throw new Error(`GitHub API error (${reposRes.status}): ${errText}`);
  }

  const reposData: GithubRepo[] = await reposRes.json();
  if (!Array.isArray(reposData)) {
    throw new Error("Invalid repository list returned by GitHub");
  }

  const effectiveUsername = username || reposData[0]?.full_name?.split("/")[0] || "GitHub User";

  const extractedSkills: SkillItem[] = [];
  const projects: ProjectExperience[] = [];

  const categorizedSkills = {
    Languages: new Set<string>(),
    Frameworks: new Set<string>(),
    Databases: new Set<string>(),
    ToolsAndCloud: new Set<string>(),
    Methodologies: new Set<string>(),
  };

  const addSkill = (name: string, sourceRepo: string, evidence: string, versionDetails?: string) => {
    const trimmed = name.trim();
    if (!trimmed || NOISE_SKILLS.has(trimmed.toLowerCase())) return;

    const category = categorizeSkill(trimmed);
    categorizedSkills[category].add(trimmed);

    const existing = extractedSkills.find(
      s => s.name.toLowerCase() === trimmed.toLowerCase() && s.sourceRepo === sourceRepo
    );
    if (!existing) {
      extractedSkills.push({
        name: trimmed,
        category,
        versionDetails,
        sourceRepo,
        evidence,
        confidence: versionDetails ? "high" : "medium"
      });
    }
  };

  // Always add Git / GitHub
  addSkill("Git", "GitHub Account", "Candidate has active GitHub profile and repositories");
  addSkill("GitHub", "GitHub Account", "Candidate uses GitHub for version control and CI/CD");

  // Process up to 30 most active repos
  const targetRepos = reposData.slice(0, 30);

  for (const repo of targetRepos) {
    const repoSkills: string[] = [];

    const addRepoSkill = (name: string, evidence: string, versionDetails?: string) => {
      const trimmed = name.trim();
      if (!trimmed || NOISE_SKILLS.has(trimmed.toLowerCase())) return;

      addSkill(trimmed, repo.name, evidence, versionDetails);
      if (!repoSkills.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
        repoSkills.push(trimmed);
      }
    };

    // A. Match Tech Keywords from Repo Name & Description & Topics
    const textToMatch = `${repo.name} ${repo.description || ""} ${(repo.topics || []).join(" ")}`;
    for (const tech of TECH_PATTERNS) {
      if (tech.pattern.test(textToMatch)) {
        addRepoSkill(tech.name, `Detected in repository name/description/topics for ${repo.name}`);
        if (tech.extraSkills) {
          tech.extraSkills.forEach(extra => addRepoSkill(extra, `Inferred from ${tech.name} on ${repo.name}`));
        }
      }
    }

    // B. Fetch All Languages via GitHub Languages API
    try {
      const langUrl = `https://api.github.com/repos/${repo.full_name}/languages`;
      const langRes = await fetch(langUrl, { headers });
      if (langRes.ok) {
        const langData: Record<string, number> = await langRes.json();
        for (const langName of Object.keys(langData)) {
          addRepoSkill(langName, `Detected in repository languages breakdown for ${repo.name}`);
        }
      }
    } catch {
      if (repo.language) {
        addRepoSkill(repo.language, `Primary language for ${repo.name}`);
      }
    }

    // C. Explicit Topics
    if (repo.topics && repo.topics.length > 0) {
      repo.topics.forEach((t) => {
        addRepoSkill(t, `GitHub topic tag on ${repo.name}`);
      });
    }

    // D. Fetch Recursive Git Tree to discover nested files
    let treeItems: TreeItem[] = [];
    try {
      const defaultBranch = repo.default_branch || "main";
      const treeUrl = `https://api.github.com/repos/${repo.full_name}/git/trees/${defaultBranch}?recursive=1`;
      const treeRes = await fetch(treeUrl, { headers });
      if (treeRes.ok) {
        const treeData = await treeRes.json();
        treeItems = treeData.tree || [];
      }
    } catch {
      // Fallback
    }

    // E. Scan File Extensions and Signatures across Tree
    const manifestPaths: string[] = [];

    for (const item of treeItems) {
      const lowerPath = item.path.toLowerCase();

      // Skip vendor, dependencies, and virtual environments
      if (
        lowerPath.includes("node_modules/") ||
        lowerPath.includes("venv/") ||
        lowerPath.includes(".venv/") ||
        lowerPath.includes("env/") ||
        lowerPath.includes(".env/") ||
        lowerPath.includes("dist/") ||
        lowerPath.includes("build/") ||
        lowerPath.includes(".git/") ||
        lowerPath.includes(".next/")
      ) {
        continue;
      }

      // Framework Signatures
      if (lowerPath.endsWith("manage.py") || lowerPath.endsWith("wsgi.py") || lowerPath.endsWith("asgi.py")) {
        addRepoSkill("Django", `Django signature file (${item.path}) detected in repository`);
        addRepoSkill("Python", `Python signature file (${item.path}) detected in repository`);
        addRepoSkill("REST API", `Django API backend detected in repository`);
      }
      if (lowerPath.includes("next.config.")) {
        addRepoSkill("Next.js", `Next.js config (${item.path}) detected`);
        addRepoSkill("React", `React framework detected`);
      }
      if (lowerPath.includes("vite.config.")) {
        addRepoSkill("Vite", `Vite build config (${item.path}) detected`);
      }
      if (lowerPath.includes("tailwind.config.")) {
        addRepoSkill("Tailwind CSS", `Tailwind CSS config (${item.path}) detected`);
      }
      if (lowerPath.endsWith("tsconfig.json")) {
        addRepoSkill("TypeScript", `TypeScript config (${item.path}) detected`);
      }
      if (lowerPath.endsWith(".java")) {
        addRepoSkill("Java", `Source .java files detected in repository tree`);
      }
      if (lowerPath.endsWith(".go") || lowerPath.endsWith("go.mod")) {
        addRepoSkill("Go", `Source .go / go.mod files detected in repository tree`);
      }
      if (lowerPath.endsWith(".py")) {
        addRepoSkill("Python", `Source .py files detected in repository tree`);
      }
      if (lowerPath.endsWith("cargo.toml")) {
        addRepoSkill("Rust", `Cargo.toml detected in repository tree`);
      }
      if (lowerPath.includes("dockerfile") || lowerPath.includes("docker-compose")) {
        addRepoSkill("Docker", `Dockerfile / docker-compose detected in repo tree`);
      }
      if (lowerPath.includes("mongo") || lowerPath.includes("mongodb")) {
        addRepoSkill("MongoDB", `MongoDB references / files detected in codebase`);
      }
      if (lowerPath.includes("capacitor.config.")) {
        addRepoSkill("Capacitor", `Capacitor mobile config detected`);
        addRepoSkill("Mobile App", `Capacitor mobile build detected`);
      }

      // Collect manifest paths
      if (
        lowerPath.endsWith("package.json") ||
        lowerPath.endsWith("pom.xml") ||
        lowerPath.endsWith("build.gradle") ||
        lowerPath.endsWith("build.gradle.kts") ||
        lowerPath.endsWith("requirements.txt") ||
        lowerPath.endsWith("pipfile") ||
        lowerPath.endsWith("pyproject.toml") ||
        lowerPath.endsWith("setup.py") ||
        lowerPath.includes("requirements/")
      ) {
        manifestPaths.push(item.path);
      }
    }

    // F. Parse discovered manifest files (prioritize non-nested and python/node manifests)
    const sortedManifests = manifestPaths.sort((a, b) => {
      // Prioritize root or primary manifests over deeply nested ones
      const depthA = a.split("/").length;
      const depthB = b.split("/").length;
      return depthA - depthB;
    });

    const processedManifests = sortedManifests.slice(0, 8);
    for (const mPath of processedManifests) {
      try {
        const fileUrl = `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch || 'main'}/${mPath}`;
        const fileRes = await fetch(fileUrl, { headers });
        if (!fileRes.ok) continue;

        const rawText = await fileRes.text();
        // Clean null bytes (UTF-16 LE encoding), BOM markers, and non-printable noise
        const contentText = rawText
          .replace(/\0/g, '')
          .replace(/^\uFEFF/, '')
          .replace(/^[^\x20-\x7E\s]+/, '');

        const lowerMPath = mPath.toLowerCase();

        if (lowerMPath.endsWith("package.json")) {
          try {
            const pkgJson = JSON.parse(contentText);
            const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
            for (const [depName, depVersion] of Object.entries(allDeps)) {
              const cleanVersion = String(depVersion).replace(/[\^~>=]/g, "").trim();
              const lowerDep = depName.toLowerCase();

              if (NPM_MAPPINGS[lowerDep]) {
                const mapInfo = NPM_MAPPINGS[lowerDep];
                addRepoSkill(mapInfo.name, `Found in ${mPath}`, cleanVersion);
                if (mapInfo.extra) {
                  mapInfo.extra.forEach(ext => addRepoSkill(ext, `Inferred from ${mapInfo.name} in ${mPath}`));
                }
              } else if (!NOISE_SKILLS.has(lowerDep) && !lowerDep.startsWith("@types/") && !lowerDep.startsWith("eslint")) {
                const formatted = depName.replace(/^@[^/]+\//, "").split("/")[0];
                if (formatted.length > 2 && !NOISE_SKILLS.has(formatted.toLowerCase())) {
                  addRepoSkill(formatted, `Dependency in ${mPath}`, cleanVersion);
                }
              }
            }
          } catch {}
        } else if (lowerMPath.endsWith("pom.xml") || lowerMPath.endsWith("build.gradle") || lowerMPath.endsWith("build.gradle.kts")) {
          addRepoSkill("Java", `Build manifest ${mPath} detected in repo`);

          if (contentText.includes("spring-boot") || contentText.includes("springframework")) {
            addRepoSkill("Spring Boot", `Detected spring framework in ${mPath}`);
            addRepoSkill("REST API", `Spring REST Web Service in ${mPath}`);
            addRepoSkill("Microservices", `Spring Boot microservice in ${mPath}`);
          }
          if (contentText.includes("mongodb") || contentText.includes("spring-boot-starter-data-mongodb")) {
            addRepoSkill("MongoDB", `Detected Spring Data MongoDB in ${mPath}`);
          }
          if (contentText.includes("postgresql") || contentText.includes("postgres")) {
            addRepoSkill("PostgreSQL", `PostgreSQL driver found in ${mPath}`);
          }
        } else if (
          lowerMPath.endsWith("requirements.txt") ||
          lowerMPath.endsWith("pipfile") ||
          lowerMPath.endsWith("pyproject.toml") ||
          lowerMPath.endsWith("setup.py") ||
          lowerMPath.includes("requirements/")
        ) {
          addRepoSkill("Python", `Python manifest ${mPath} detected in repo`);
          const lines = contentText.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#")) {
              const parts = trimmed.split(/==|>=|<=|~|=|;/);
              const rawLib = parts[0].replace(/[\[\],\'\"]/g, "").trim().toLowerCase();
              const version = parts[1]?.replace(/[\[\],\'\"]/g, "").trim();
              if (rawLib) {
                if (PYTHON_MAPPINGS[rawLib]) {
                  const mapInfo = PYTHON_MAPPINGS[rawLib];
                  addRepoSkill(mapInfo.name, `Python library in ${mPath}`, version);
                  if (mapInfo.extra) {
                    mapInfo.extra.forEach(ext => addRepoSkill(ext, `Inferred from ${mapInfo.name} in ${mPath}`));
                  }
                } else if (!NOISE_SKILLS.has(rawLib) && rawLib.length > 2) {
                  addRepoSkill(rawLib, `Python library in ${mPath}`, version);
                }
              }
            }
          }
        }
      } catch {}
    }

    // G. Parse README.md
    let readmeText = "";
    try {
      const readmeUrl = `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch || 'main'}/README.md`;
      const readmeRes = await fetch(readmeUrl, { headers });
      if (readmeRes.ok) {
        readmeText = await readmeRes.text();
        for (const tech of TECH_PATTERNS) {
          if (tech.pattern.test(readmeText)) {
            addRepoSkill(tech.name, `Mentioned in README.md`);
            if (tech.extraSkills) {
              tech.extraSkills.forEach(extra => addRepoSkill(extra, `Inferred from ${tech.name} in README.md`));
            }
          }
        }
      }
    } catch {}

    // Sort and prioritize skills for this repo
    const prioritizedSkills = prioritizeSkills(repoSkills);

    projects.push({
      name: repo.name,
      repoUrl: repo.html_url,
      description: repo.description || (readmeText ? readmeText.slice(0, 150) + "..." : "GitHub Project"),
      topics: repo.topics || [],
      extractedSkills: prioritizedSkills,
      primaryLanguage: repo.language || "N/A",
      stars: repo.stargazers_count,
      updatedAt: repo.updated_at
    });
  }

  return {
    username: effectiveUsername,
    scannedAt: new Date().toISOString(),
    skills: extractedSkills,
    projects,
    categorized: {
      Languages: Array.from(categorizedSkills.Languages),
      Frameworks: Array.from(categorizedSkills.Frameworks),
      Databases: Array.from(categorizedSkills.Databases),
      ToolsAndCloud: Array.from(categorizedSkills.ToolsAndCloud),
      Methodologies: Array.from(categorizedSkills.Methodologies),
    }
  };
}
