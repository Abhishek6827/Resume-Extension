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
    const category = categorizeSkill(name);
    categorizedSkills[category].add(name);

    const existing = extractedSkills.find(s => s.name.toLowerCase() === name.toLowerCase() && s.sourceRepo === sourceRepo);
    if (!existing) {
      extractedSkills.push({
        name,
        category,
        versionDetails,
        sourceRepo,
        evidence,
        confidence: versionDetails ? "high" : "medium"
      });
    }
  };

  // Always add Git since profile is hosted on GitHub
  addSkill("Git", "GitHub Account", "Candidate has active GitHub profile and repositories");
  addSkill("GitHub", "GitHub Account", "Candidate uses GitHub for version control and CI/CD");

  // Process all repositories (up to 30 most active)
  const targetRepos = reposData.slice(0, 30);

  for (const repo of targetRepos) {
    const repoSkills: string[] = [];

    // A. Fetch All Languages used in this repository via GitHub Languages API
    try {
      const langUrl = `https://api.github.com/repos/${repo.full_name}/languages`;
      const langRes = await fetch(langUrl, { headers });
      if (langRes.ok) {
        const langData: Record<string, number> = await langRes.json();
        for (const langName of Object.keys(langData)) {
          addSkill(langName, repo.name, `Detected in repository languages breakdown for ${repo.name}`);
          repoSkills.push(langName);
        }
      }
    } catch {
      if (repo.language) {
        addSkill(repo.language, repo.name, `Primary language for ${repo.name}`);
        repoSkills.push(repo.language);
      }
    }

    // B. Topics / Tags
    if (repo.topics && repo.topics.length > 0) {
      repo.topics.forEach((t) => {
        addSkill(t, repo.name, `GitHub topic tag on ${repo.name}`);
        repoSkills.push(t);
      });
    }

    // C. Fetch Recursive Git Tree to discover nested files
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
      // Fallback if tree fails
    }

    // D. Scan File Extensions and Paths across Tree
    let hasJavaFiles = false;
    let hasGoFiles = false;
    let hasPythonFiles = false;
    let hasDockerFiles = false;
    let hasMongoMention = false;

    const manifestPaths: string[] = [];

    for (const item of treeItems) {
      const lowerPath = item.path.toLowerCase();

      if (lowerPath.endsWith(".java")) hasJavaFiles = true;
      if (lowerPath.endsWith(".go") || lowerPath.endsWith("go.mod")) hasGoFiles = true;
      if (lowerPath.endsWith(".py")) hasPythonFiles = true;
      if (lowerPath.includes("dockerfile") || lowerPath.includes("docker-compose")) hasDockerFiles = true;
      if (lowerPath.includes("mongo") || lowerPath.includes("mongodb")) hasMongoMention = true;

      // Collect manifest paths (package.json, pom.xml, build.gradle, requirements.txt)
      if (
        lowerPath.endsWith("package.json") ||
        lowerPath.endsWith("pom.xml") ||
        lowerPath.endsWith("build.gradle") ||
        lowerPath.endsWith("requirements.txt")
      ) {
        manifestPaths.push(item.path);
      }
    }

    if (hasJavaFiles) {
      addSkill("Java", repo.name, `Source .java files detected in repository tree`);
      repoSkills.push("Java");
    }
    if (hasGoFiles) {
      addSkill("Go", repo.name, `Source .go / go.mod files detected in repository tree`);
      addSkill("Golang", repo.name, `Source .go files detected in repository tree`);
      repoSkills.push("Go");
    }
    if (hasPythonFiles) {
      addSkill("Python", repo.name, `Source .py files detected in repository tree`);
      repoSkills.push("Python");
    }
    if (hasDockerFiles) {
      addSkill("Docker", repo.name, `Dockerfile / docker-compose detected in repo tree`);
      repoSkills.push("Docker");
    }
    if (hasMongoMention) {
      addSkill("MongoDB", repo.name, `MongoDB references / files detected in codebase`);
      repoSkills.push("MongoDB");
    }

    // E. Parse discovered manifest files (root or nested)
    const processedManifests = manifestPaths.slice(0, 5); // top 5 manifests per repo
    for (const mPath of processedManifests) {
      try {
        const fileUrl = `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch || 'main'}/${mPath}`;
        const fileRes = await fetch(fileUrl, { headers });
        if (!fileRes.ok) continue;

        const contentText = await fileRes.text();

        if (mPath.endsWith("package.json")) {
          try {
            const pkgJson = JSON.parse(contentText);
            const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
            for (const [depName, depVersion] of Object.entries(allDeps)) {
              const cleanVersion = String(depVersion).replace(/[\^~>=]/g, "").trim();
              const lowerDep = depName.toLowerCase();

              if (lowerDep === "react") addSkill("React", repo.name, `Found in ${mPath}`, cleanVersion);
              else if (lowerDep === "next" || lowerDep.includes("next")) addSkill("Next.js", repo.name, `Found in ${mPath}`, cleanVersion);
              else if (lowerDep === "express") {
                addSkill("Express.js", repo.name, `Found in ${mPath}`, cleanVersion);
                addSkill("REST API", repo.name, `Express server found in ${mPath}`);
              }
              else if (lowerDep === "tailwindcss") addSkill("Tailwind CSS", repo.name, `Found in ${mPath}`, cleanVersion);
              else if (lowerDep === "typescript") addSkill("TypeScript", repo.name, `Found in ${mPath}`, cleanVersion);
              else if (lowerDep === "prisma" || lowerDep === "@prisma/client") addSkill("Prisma ORM", repo.name, `Found in ${mPath}`, cleanVersion);
              else if (lowerDep === "mongoose" || lowerDep === "mongodb") addSkill("MongoDB", repo.name, `Found in ${mPath}`, cleanVersion);
              else if (lowerDep === "pg" || lowerDep === "postgres") addSkill("PostgreSQL", repo.name, `Found in ${mPath}`, cleanVersion);
              else if (lowerDep === "redis" || lowerDep === "ioredis") addSkill("Redis", repo.name, `Found in ${mPath}`, cleanVersion);
              else if (lowerDep.includes("docker")) addSkill("Docker", repo.name, `Found in ${mPath}`, cleanVersion);
              else if (lowerDep.includes("aws") || lowerDep.includes("@aws-sdk")) addSkill("AWS", repo.name, `Found in ${mPath}`, cleanVersion);
              else {
                const formatted = depName.replace(/^@[^/]+\//, "").split("/")[0];
                if (formatted.length > 2) {
                  addSkill(formatted, repo.name, `Dependency in ${mPath}`, cleanVersion);
                  repoSkills.push(formatted);
                }
              }
            }
          } catch {}
        } else if (mPath.endsWith("pom.xml") || mPath.endsWith("build.gradle")) {
          addSkill("Java", repo.name, `Build manifest ${mPath} detected in repo`);
          repoSkills.push("Java");

          if (contentText.includes("spring-boot") || contentText.includes("springframework")) {
            addSkill("Spring Boot", repo.name, `Detected spring framework in ${mPath}`);
            addSkill("REST API", repo.name, `Spring REST Web Service in ${mPath}`);
            addSkill("Microservices", repo.name, `Spring Boot microservice in ${mPath}`);
            repoSkills.push("Spring Boot");
          }
          if (contentText.includes("mongodb") || contentText.includes("spring-boot-starter-data-mongodb")) {
            addSkill("MongoDB", repo.name, `Detected Spring Data MongoDB in ${mPath}`);
            repoSkills.push("MongoDB");
          }
        } else if (mPath.endsWith("requirements.txt")) {
          const lines = contentText.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#")) {
              const parts = trimmed.split(/==|>=|<=|~/);
              const libName = parts[0].trim();
              const version = parts[1]?.trim();
              if (libName) {
                if (libName.toLowerCase() === "pymongo" || libName.toLowerCase() === "django-mongodb-engine") {
                  addSkill("MongoDB", repo.name, `Found in ${mPath}`, version);
                }
                addSkill(libName, repo.name, `Python library in ${mPath}`, version);
                repoSkills.push(libName);
              }
            }
          }
        }
      } catch {}
    }

    // F. Parse README.md
    let readmeText = "";
    try {
      const readmeUrl = `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch || 'main'}/README.md`;
      const readmeRes = await fetch(readmeUrl, { headers });
      if (readmeRes.ok) {
        readmeText = await readmeRes.text();
        const lowerReadme = readmeText.toLowerCase();

        const techKeywords = [
          "Java", "Spring Boot", "MongoDB", "Mongo", "Docker", "Kubernetes",
          "GraphQL", "REST API", "RESTful", "CI/CD", "Kafka", "Microservices",
          "TensorFlow", "PyTorch", "AWS", "Azure", "GCP", "PostgreSQL", "Redis", "Go", "Golang"
        ];
        
        techKeywords.forEach(tech => {
          if (lowerReadme.includes(tech.toLowerCase())) {
            const targetName = tech === "Mongo" ? "MongoDB" : (tech === "Golang" ? "Go" : tech);
            addSkill(targetName, repo.name, `Mentioned in README.md`);
            repoSkills.push(targetName);
          }
        });
      }
    } catch {}

    projects.push({
      name: repo.name,
      repoUrl: repo.html_url,
      description: repo.description || (readmeText ? readmeText.slice(0, 150) + "..." : "GitHub Project"),
      topics: repo.topics || [],
      extractedSkills: Array.from(new Set(repoSkills)),
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
