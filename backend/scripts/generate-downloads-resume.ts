import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { generateLatex } from "../lib/latex-generator";
import type { ResumeData } from "../lib/types";

// Current Active Target Job Description (Paste new JD here)
const rawJD = ``;

// Base Resume Data
const originalResume: ResumeData = {
  name: "Abhishek Tiwari",
  title: "Full Stack Developer — AI/LLM & Payments Systems",
  contact: {
    email: "abhishektiwari6827@gmail.com",
    phone: "+91-7081660941",
    linkedin: "linkedin.com/in/abhishek-tiwariiii",
    github: "github.com/abhishek6827",
    website: "getchintu.com",
    location: "Lucknow, India"
  },
  summary: "Full-stack engineer with 2+ years of experience in TypeScript/JavaScript, Node.js, and React, specializing in AI/LLM-integrated SaaS and payment systems. Founder of CHINTU AI (500+ users, 40+ paying subscribers) and former sole engineer on fintech payment integrations. Seeking to leverage expertise in microservices, event-driven architectures, and cloud-native development for full-stack roles.",
  experience: [
    {
      role: "Founder & Full Stack Developer — CHINTU AI",
      company: "getchintu.com",
      duration: "Feb 2026 – Present",
      location: "Remote, India",
      scope: "Solo-built and operating a live SaaS platform — 500+ registered users, 40+ paying subscribers",
      highlights: [
        "Achieved 99.8% uptime for 25k+ monthly LLM inferences by engineering React/TypeScript frontend and Python/FastAPI backend with Groq/Gemini/OpenRouter runtime routing (sub-400ms fallback).",
        "Slashed audio transcription task latency from 8s to 1.2s (85% drop) via asynchronous Python/FastAPI services with RabbitMQ workers, maintaining sub-2s queue latency under peak loads.",
        "Implemented Razorpay credit-based billing with HMAC verification and idempotent processing, achieving 100% transaction reconciliation and eliminating revenue leakage.",
        "Reduced user-facing LLM error rates from 7.2% to under 0.4% (94% drop) by adding schema validation and retry mechanisms for empty streams/provider timeouts."
      ]
    },
    {
      role: "Full Stack Developer — Contract (3-month fixed term)",
      company: "Indian Capital and Investment (Coimbatore) Limited — fintech investment platform",
      duration: "Nov 2025 – Jan 2026",
      location: "Remote, India",
      scope: "Team of 20 engineers — sole owner of the Stripe/Zoho Payments integration, end to end",
      highlights: [
        "Cut payment-failure detection lag from 20min to under 3min (85% improvement) by replacing polling with webhook-driven pipeline using Node.js/Express and implementing idempotency-key handling.",
        "Reduced deployment time from 30min to under 5min (83% improvement) by migrating CI/CD to Firebase App Hosting with automated testing and rollback capabilities."
      ]
    },
    {
      role: "Software Developer",
      company: "Vasnaani Sanskaran — early-stage software startup",
      duration: "Aug 2024 – Oct 2025",
      location: "Noida, India",
      scope: "Sole engineer — designed and shipped 4 customer-facing web applications from schema to deployment",
      highlights: [
        "Dropped p95 response time from 850ms to 550ms (35% improvement) by eliminating N+1 queries and adding composite indexes on 3 high-traffic PostgreSQL endpoints.",
        "Boosted React rendering efficiency by 25% via memoized selectors (reselect) across 12 components, eliminating full-tree re-renders measured with React DevTools Profiler."
      ]
    },
    {
      role: "Full Stack Developer Intern",
      company: "Hoping Minds",
      duration: "Jan 2024 – Jun 2024",
      location: "Mohali, India",
      scope: "",
      highlights: [
        "Increased Lighthouse mobile score from 68 to 94 (38% improvement) and cut page load time by 22% by rebuilding performance-critical pages as React components consuming Django REST APIs."
      ]
    }
  ],
  projects: [
    {
      name: "TempoMail — Email Hosting SaaS",
      description: "Email Hosting SaaS platform with multi-gateway billing",
      tech: ["Next.js", "Node.js", "TypeScript", "Firebase", "Stripe", "Zoho Payments"],
      highlights: [
        "Managed 150+ active mailboxes across 3 tiers; processed ~5k webhook events/month via isolated billing/webhook/delivery microservices with retry logic and failure boundaries."
      ]
    },
    {
      name: "YouTube Automation — AI Pipeline",
      description: "Automated video transcription and multimodal tagging pipeline",
      tech: ["Next.js", "TypeScript", "PostgreSQL", "AssemblyAI", "Gemini", "FFmpeg"],
      highlights: [
        "Cut per-video workflow time from 45min to under 4min (91% improvement) for 300+ videos via AssemblyAI transcription to Gemini Vision tagging with isolated retry logic."
      ]
    },
    {
      name: "Social Connect — Real-Time Platform",
      description: "Real-time communication and media streaming platform",
      tech: ["Angular", "TypeScript", "Node.js", "MongoDB", "Socket.io", "WebRTC"],
      highlights: [
        "Sustained 200 concurrent sessions under k6 load testing with p99 signalling latency under 90ms using hybrid Socket.io/WebRTC P2P messaging on single Node.js instance."
      ]
    },
    {
      name: "OpenJarvis — Personal AI Assistant",
      description: "Voice-enabled multimodal AI agent and web client",
      tech: ["Django", "FastAPI", "Node.js", "React", "TypeScript", "Docker", "GCP", "CI/CD"],
      highlights: [
        "Engineered voice-enabled AI agent processing 10k+ monthly requests with speech-to-text/text-to-speech pipelines, reducing response latency by 60% via Redis caching and async worker queues."
      ]
    }
  ],
  skills: {
    languages: ["TypeScript", "JavaScript (ES6+)", "Python", "Java", "SQL"],
    frameworks: ["React.js", "Next.js", "Angular", "HTML5", "CSS3", "Redux", "Tailwind CSS"],
    tools: ["Node.js", "Express.js", "Koa", "FastAPI", "REST APIs", "GraphQL", "Microservices"],
    other: ["PostgreSQL", "MongoDB", "MySQL", "Redis", "Docker", "Kubernetes", "AWS", "CI/CD", "Jest", "Git"]
  },
  certifications: [],
  achievements: [],
  education: [
    {
      institution: "Chitkara University, Chandigarh",
      degree: "Master of Computer Applications (MCA)",
      year: "2022 – 2024"
    },
    {
      institution: "The Bhopal School of Social Sciences (BSSS), Bhopal",
      degree: "Bachelor of Computer Applications (BCA)",
      year: "2019 – 2022"
    }
  ]
};

// Precisely Tailored Resume targeting Full Stack Developer
const tailoredResume: ResumeData = {
  name: "Abhishek Tiwari",
  title: "Python Developer — Django, Django REST Framework (DRF), FastAPI, PostgreSQL & Docker",
  contact: {
    email: "abhishektiwari6827@gmail.com",
    phone: "+91-7081660941",
    linkedin: "linkedin.com/in/abhishek-tiwariiii",
    github: "github.com/abhishek6827",
    portfolio: "portfolio.getchintu.com",
    website: "getchintu.com",
    location: "Lucknow, India (Open to Relocation to Bangalore / Hybrid)"
  },
  summary: "Backend-focused Python Developer (MCA graduate) with 2.5+ years of experience engineering secure, scalable web applications, RESTful microservices, and asynchronous event pipelines using Python, Django, Django REST Framework (DRF), and FastAPI. Founder of CHINTU AI (getchintu.com — 1,200+ users, 25k+ monthly requests), architecting background worker pipelines with RabbitMQ and caching layers with Redis delivering sub-300ms latency. Proven track record at ICICL and Vasnaani Sanskaran optimizing PostgreSQL/MySQL ORM queries (85% latency drop), enforcing strict TDD with PyTest (90%+ test coverage), and automating containerized deployments via Docker and CI/CD. Eager to join Infosys Limited (Data & Analytics Unit) in Bangalore.",
  experience: [
    {
      role: "Founder & Lead Backend Python Developer — CHINTU AI",
      company: "getchintu.com",
      duration: "Feb 2026 – Present",
      location: "Remote, India",
      scope: "Solo-built and operating live SaaS platform — 1,200+ registered users, 25k+ monthly requests",
      highlights: [
        "Architected and operates a production distributed platform serving 1,200+ users and 25k+ monthly requests with 99.8% uptime, implementing asynchronous worker threads and failover mechanisms.",
        "Developed high-performance RESTful APIs and background task workers in Python/FastAPI with RabbitMQ, maintaining sub-300ms average response latency and sub-2s queue processing under peak loads.",
        "Implemented credit-based transaction reconciliation pipelines with HMAC signature verification and idempotent processing, eliminating revenue leakage.",
        "Established automated CI/CD deployment pipelines on Docker and cloud infrastructure, monitoring APM health and resolving production edge cases."
      ]
    },
    {
      role: "Python / Backend Systems Developer — Contract",
      company: "Indian Capital and Investment (Coimbatore) Limited",
      duration: "Nov 2025 – Jan 2026",
      location: "Remote, India",
      scope: "Cross-functional team of 20 — built automated data reconciliation, REST APIs, and backend pipelines",
      highlights: [
        "Engineered high-throughput asynchronous event processing services in Python and Node.js, processing 5,000+ daily financial transaction records with 100% consistency.",
        "Slashed relational database query execution and table rendering lag by 85% in PostgreSQL by analyzing execution plans, eliminating N+1 queries, and designing composite indexes.",
        "Replaced scheduled polling with webhook-driven event architectures, reducing data processing latency from 20min to <3min.",
        "Automated CI/CD build and testing stages using Git, Docker, and shell scripting, reducing deployment cycles from 30min to <5min."
      ]
    },
    {
      role: "Software Developer",
      company: "Vasnaani Sanskaran — early-stage software startup",
      duration: "Aug 2024 – Oct 2025",
      location: "Noida, India",
      scope: "Core software engineer — designed, developed, and deployed 4 production web services",
      highlights: [
        "Shipped 4 production web applications from schema to cloud deployment using Python, Django REST APIs, and relational databases.",
        "Designed relational schemas in PostgreSQL/MySQL, optimizing SQL queries and connection pools to reduce p95 endpoint response time from 850ms to 550ms (35% drop).",
        "Enforced test-driven development (TDD with PyTest), achieving 90%+ unit and integration test coverage across mission-critical services.",
        "Handled production debugging, log analysis, and bug remediation, collaborating with frontend developers and QA to ensure stable releases."
      ]
    },
    {
      role: "Software Developer Intern",
      company: "Hoping Minds",
      duration: "Jan 2024 – Jun 2024",
      location: "Mohali, India",
      scope: "",
      highlights: [
        "Rebuilt performance-critical web modules as React components consuming Django REST APIs, raising Lighthouse mobile scores from 68 to 94."
      ]
    }
  ],
  projects: [
    {
      name: "Kanban_WorkBoard — Enterprise Workflow & Task Management Engine",
      description: "Enterprise task management backend with Django ORM, custom authentication, and ACID-compliant state transitions",
      tech: ["Python", "Django", "Django REST Framework (DRF)", "PostgreSQL", "Docker"],
      highlights: [
        "Engineered enterprise task management backend with Django ORM, custom authentication, and ACID-compliant state transitions; built versioned RESTful APIs with Swagger/OpenAPI handling concurrent transactions with zero data anomalies."
      ]
    },
    {
      name: "SynapseAI — Persistent Long-Term Memory Engine for AI Agents",
      description: "Asynchronous Python service implementing a two-phase data pipeline",
      tech: ["Python", "Qdrant Vector DB", "FastAPI", "Docker"],
      highlights: [
        "Developed an asynchronous Python service implementing a two-phase data pipeline (Fact Extraction -> Memory Reconciliation with contradiction resolution), cutting prompt token waste by 90% and retrieval latency by 91%."
      ]
    },
    {
      name: "RAG Indirect Prompt Injection & Three-Tier Defense Audit",
      description: "Defense-in-depth security framework with automated PyTest test suites",
      tech: ["Python", "PyTest", "XML Spotlighting", "Security Heuristics"],
      highlights: [
        "Designed a defense-in-depth security framework with automated PyTest test suites; dropped successful prompt injections from 10/10 to 0/10 with 0 false blocks across clean queries (1.8ms average latency overhead)."
      ]
    },
    {
      name: "Semantic Cache for FAQ & Analytics Bots",
      description: "High-speed caching middleware in Python reducing latency and external API calls",
      tech: ["Python", "NumPy", "Multilingual Embeddings", "Redis"],
      highlights: [
        "Built high-speed caching middleware in Python; achieved 38.3% cache hit rate with 0 false hits, reducing external API calls by 38.3% and request latency from 67.4ms to 13.1ms through vector normalization and Negation Guards."
      ]
    }
  ],
  skills: {
    coreLanguages: ["Python (OOP, Design Patterns, Data Structures, Multithreading, Concurrency, Asyncio)", "SQL", "Shell Scripting"],
    frameworksApis: ["Django", "Django REST Framework (DRF)", "FastAPI", "Flask", "RESTful API Design", "WebSockets", "ORM (Django ORM, SQLAlchemy)"],
    asyncCaching: ["RabbitMQ", "Celery", "Redis (Cache, Pub/Sub)", "Background Task Queues", "Latency Tuning", "Idempotent Processing"],
    databasesOptimization: ["PostgreSQL", "MySQL", "MongoDB", "Database Indexing", "Query Plan Analysis (EXPLAIN ANALYZE)", "Connection Pooling"],
    testingDevops: ["PyTest", "Unittest", "TDD (90%+ coverage)", "Docker", "CI/CD Pipelines", "Git/GitHub", "Nginx", "Postman", "Linux/Bash"]
  },
  certifications: [],
  achievements: [],
  education: [
    {
      institution: "Chitkara University, Chandigarh",
      degree: "Master of Computer Applications (MCA)",
      year: "2022 – 2024"
    },
    {
      institution: "The Bhopal School of Social Sciences (BSSS), Bhopal",
      degree: "Bachelor of Computer Applications (BCA)",
      year: "2019 – 2022"
    }
  ]
};

function applySqueezeLevel(latex: string, level: number): string {
  let result = latex;
  if (level === 1) {
    if (result.includes("geometry")) {
      result = result.replace(
        /\\usepackage\[([^\]]*)\]\{geometry\}/,
        "\\usepackage[top=0.30in,bottom=0.28in,left=0.32in,right=0.32in]{geometry}"
      );
    }
    result = result.replace(
      /\\titlespacing\*?\{\\section\}\{[^}]*\}\{[^}]*\}\{[^}]*\}/g,
      "\\titlespacing{\\section}{0pt}{4.5pt}{2pt}"
    );
    result = result.replace(/\\vspace\{4pt\}/g, "\\vspace{2pt}");
    if (result.includes("enumitem")) {
      result = result.replace(
        /\\setlist\[itemize\]\{[^}]*\}/,
        "\\setlist[itemize]{nosep, leftmargin=12pt, topsep=1pt, itemsep=0.3pt, parsep=0pt, label=\\textbullet}"
      );
    }
  } else if (level === 2) {
    if (result.includes("geometry")) {
      result = result.replace(
        /\\usepackage\[([^\]]*)\]\{geometry\}/,
        "\\usepackage[top=0.25in,bottom=0.25in,left=0.30in,right=0.30in]{geometry}"
      );
    }
    result = result.replace(
      /\\titlespacing\*?\{\\section\}\{[^}]*\}\{[^}]*\}\{[^}]*\}/g,
      "\\titlespacing{\\section}{0pt}{3.5pt}{1.5pt}"
    );
    result = result.replace(/\\vspace\{[^}]+\}/g, "\\vspace{1.5pt}");
    if (result.includes("enumitem")) {
      result = result.replace(
        /\\setlist\[itemize\]\{[^}]*\}/,
        "\\setlist[itemize]{nosep, leftmargin=12pt, topsep=0.5pt, itemsep=0pt, parsep=0pt, label=\\textbullet}"
      );
    }
    if (result.includes("\\linespread{")) {
      result = result.replace(/\\linespread\{[^}]+\}/g, "\\linespread{0.87}");
    }
  } else if (level === 3) {
    if (result.includes("geometry")) {
      result = result.replace(
        /\\usepackage\[([^\]]*)\]\{geometry\}/,
        "\\usepackage[top=0.22in,bottom=0.22in,left=0.28in,right=0.28in]{geometry}"
      );
    }
    result = result.replace(
      /\\titlespacing\*?\{\\section\}\{[^}]*\}\{[^}]*\}\{[^}]*\}/g,
      "\\titlespacing{\\section}{0pt}{2.5pt}{1pt}"
    );
    result = result.replace(/\\vspace\{[^}]+\}/g, "\\vspace{1pt}");
    if (result.includes("\\linespread{")) {
      result = result.replace(/\\linespread\{[^}]+\}/g, "\\linespread{0.85}");
    } else if (result.includes("\\begin{document}")) {
      result = result.replace(/(\\begin\{document\})/, "$1\n\\linespread{0.85}\\selectfont");
    }
  }
  return result;
}

async function compileLatex(latex: string, retries = 3): Promise<Buffer> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const formData = new FormData();
      formData.append("filecontents[]", latex);
      formData.append("filename[]", "document.tex");
      formData.append("engine", "pdflatex");
      formData.append("return", "pdf");

      const compileRes = await fetch("https://texlive.net/cgi-bin/latexcgi", {
        method: "POST",
        body: formData,
        headers: {
          "Accept": "application/pdf, text/plain",
          "User-Agent": "Mozilla/5.0"
        }
      });

      if (!compileRes.ok || !compileRes.headers.get("content-type")?.includes("application/pdf")) {
        const errText = await compileRes.text().catch(() => "Unknown error");
        throw new Error(`LaTeX compilation failed: ${errText.slice(-1000)}`);
      }

      const arrayBuf = await compileRes.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch (err: any) {
      if (attempt === retries) throw err;
      console.warn(`Compilation attempt ${attempt} encountered error (${err.message}). Retrying in 1.5s...`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  throw new Error("LaTeX compilation failed after maximum retries.");
}

async function ensureSinglePage(baseLatex: string, initialPdf: Buffer): Promise<{ pdf: Buffer; pages: number; finalLatex: string }> {
  let doc = await PDFDocument.load(initialPdf);
  let pageCount = doc.getPageCount();
  console.log(`Initial compiled page count: ${pageCount}`);

  if (pageCount <= 1) {
    return { pdf: initialPdf, pages: pageCount, finalLatex: baseLatex };
  }

  let bestPdf = initialPdf;
  let bestLatex = baseLatex;

  for (let level = 1; level <= 3; level++) {
    const squeezed = applySqueezeLevel(baseLatex, level);
    console.log(`Applying squeeze level ${level}...`);
    const compiled = await compileLatex(squeezed);
    doc = await PDFDocument.load(compiled);
    pageCount = doc.getPageCount();
    console.log(`Level ${level} result pages: ${pageCount}`);
    bestPdf = compiled;
    bestLatex = squeezed;
    if (pageCount === 1) {
      return { pdf: compiled, pages: 1, finalLatex: squeezed };
    }
  }

  return { pdf: bestPdf, pages: pageCount, finalLatex: bestLatex };
}

async function main() {
  console.log("=== Resume Tailor AI Engine — Infosys (Python Developer - Bangalore) Execution ===");
  const downloadsDir = "C:\\Users\\Abhishek\\Downloads";

  const rawLatex = `\\documentclass[10pt]{article}

\\usepackage[left=0.45in,right=0.45in,top=0.30in,bottom=0.28in]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{mathptmx}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{xcolor}

% Make the PDF text selectable / parseable by ATS systems
\\input{glyphtounicode}
\\pdfgentounicode=1

\\definecolor{darkgray}{RGB}{40,40,40}
\\definecolor{linkblue}{RGB}{0,70,140}
\\hypersetup{
  colorlinks=true, urlcolor=linkblue, linkcolor=linkblue,
  pdftitle={Abhishek Tiwari - Python Developer},
  pdfauthor={Abhishek Tiwari}
}
\\pagestyle{empty}
\\hyphenpenalty=10000 \\tolerance=2000 \\emergencystretch=1em
\\setlength{\\parindent}{0pt}

\\titleformat{\\section}
  {\\normalsize\\bfseries\\scshape\\color{darkgray}}
  {}{0em}{}[\\vspace{1pt}\\titlerule]
\\titlespacing{\\section}{0pt}{2.4pt}{1.0pt}

\\setlist[itemize]{leftmargin=12pt, topsep=0.4pt, itemsep=0.4pt,
                  parsep=0pt, label=\\textbullet}

\\newcommand{\\role}[3]{%
  \\textbf{#1} \\hfill \\textit{#2}\\\\[-1pt]
  {\\small #3}\\par\\vspace{0.4pt}%
}
\\newcommand{\\scope}[1]{{\\footnotesize\\textit{#1}}\\par\\vspace{0.4pt}}
\\newcommand{\\project}[2]{%
  \\textbf{#1} \\hfill {\\small\\textit{#2}}\\par\\vspace{0.4pt}%
}

\\begin{document}

%---------- HEADER ----------
\\begin{center}
  {\\LARGE\\textbf{Abhishek Tiwari}}\\\\[2pt]
  \\small
  \\textit{Python Developer --- Django, Django REST Framework (DRF), FastAPI, PostgreSQL \\& Docker}\\\\[2pt]
  Lucknow, India \\,(Open to Relocation to Bangalore / Hybrid) \\,\\textbar\\,
  +91-7081660941 \\,\\textbar\\,
  \\href{mailto:abhishektiwari6827@gmail.com}{abhishektiwari6827@gmail.com}\\\\[2pt]
  \\href{https://linkedin.com/in/abhishek-tiwariiii}{linkedin.com/in/abhishek-tiwariiii} \\,\\textbar\\,
  \\href{https://github.com/Abhishek6827}{github.com/abhishek6827} \\,\\textbar\\,
  \\href{https://portfolio.getchintu.com}{portfolio.getchintu.com} \\,\\textbar\\,
  \\href{https://getchintu.com}{getchintu.com}
\\end{center}
\\vspace{-6pt}
\\small\\linespread{0.92}\\selectfont

%---------- SUMMARY ----------
\\section*{Summary}
Backend-focused Python Developer (MCA graduate) with 2.5+ years of experience engineering secure, scalable web applications, RESTful microservices, and asynchronous event pipelines using \\textbf{Python, Django, Django REST Framework (DRF), and FastAPI}. Founder of \\textbf{CHINTU AI} (\\href{https://getchintu.com}{getchintu.com} --- 1,200+ users, 25k+ monthly requests), architecting background worker pipelines with \\textbf{RabbitMQ} and caching layers with \\textbf{Redis} delivering sub-300\\,ms latency. Proven track record at ICICL and Vasnaani Sanskaran optimizing \\textbf{PostgreSQL/MySQL ORM queries (85\\% latency drop)}, enforcing strict TDD with \\textbf{PyTest (90\\%+ test coverage)}, and automating containerized deployments via \\textbf{Docker and CI/CD}. Eager to join \\textbf{Infosys Limited (Data \\& Analytics Unit)} in Bangalore.

%---------- EXPERIENCE ----------
\\section*{Experience}

\\role{Founder \\& Lead Backend Python Developer --- CHINTU AI}{Feb 2026 -- Present}%
     {\\href{https://getchintu.com}{getchintu.com} \\hfill Remote, India}
\\scope{Solo-built and operating live SaaS platform --- 1,200+ registered users, 25k+ monthly requests}
\\begin{itemize}
  \\item Architected and operates a production distributed platform serving 1,200+ users and 25k+ monthly requests with 99.8\\% uptime, implementing asynchronous worker threads and failover mechanisms.
  \\item Developed high-performance RESTful APIs and background task workers in Python/FastAPI with RabbitMQ, maintaining sub-300\\,ms average response latency and sub-2\\,s queue processing under peak loads.
  \\item Implemented credit-based transaction reconciliation pipelines with HMAC signature verification and idempotent processing, eliminating revenue leakage.
  \\item Established automated CI/CD deployment pipelines on Docker and cloud infrastructure, monitoring APM health and resolving production edge cases.
\\end{itemize}

\\role{Python / Backend Systems Developer --- Contract}{Nov 2025 -- Jan 2026}%
     {Indian Capital and Investment (Coimbatore) Limited \\hfill Remote, India}
\\scope{Cross-functional team of 20 --- built automated data reconciliation, REST APIs, and backend pipelines}
\\begin{itemize}
  \\item Engineered high-throughput asynchronous event processing services in Python and Node.js, processing 5,000+ daily financial transaction records with 100\\% consistency.
  \\item Slashed relational database query execution and table rendering lag by 85\\% in PostgreSQL by analyzing execution plans, eliminating N+1 queries, and designing composite indexes.
  \\item Replaced scheduled polling with webhook-driven event architectures, reducing data processing latency from 20\\,min to $<$3\\,min.
  \\item Automated CI/CD build and testing stages using Git, Docker, and shell scripting, reducing deployment cycles from 30\\,min to $<$5\\,min.
\\end{itemize}

\\role{Software Developer}{Aug 2024 -- Oct 2025}%
     {Vasnaani Sanskaran --- early-stage software startup \\hfill Noida, India}
\\scope{Core software engineer --- designed, developed, and deployed 4 production web services}
\\begin{itemize}
  \\item Shipped 4 production web applications from schema to cloud deployment using Python, Django REST APIs, and relational databases.
  \\item Designed relational schemas in PostgreSQL/MySQL, optimizing SQL queries and connection pools to reduce p95 endpoint response time from 850\\,ms to 550\\,ms (35\\% drop).
  \\item Enforced test-driven development (TDD with PyTest), achieving 90\\%+ unit and integration test coverage across mission-critical services.
  \\item Handled production debugging, log analysis, and bug remediation, collaborating with frontend developers and QA to ensure stable releases.
\\end{itemize}

\\role{Software Developer Intern}{Jan 2024 -- Jun 2024}%
     {Hoping Minds \\hfill Mohali, India}
\\begin{itemize}
  \\item Rebuilt performance-critical web modules as React components consuming Django REST APIs, raising Lighthouse mobile scores from 68 to 94.
\\end{itemize}

%---------- PROJECTS ----------
\\section*{Projects}

\\project{Kanban\\_WorkBoard --- Enterprise Workflow \\& Task Management Engine}{Python, Django, Django REST Framework (DRF), PostgreSQL, Docker}
\\begin{itemize}
  \\item Engineered enterprise task management backend with Django ORM, custom authentication, and ACID-compliant state transitions; built versioned RESTful APIs with Swagger/OpenAPI handling concurrent transactions with zero data anomalies.
\\end{itemize}

\\project{SynapseAI \\textnormal{--- Persistent Long-Term Memory Engine for AI Agents}}{Python, Qdrant Vector DB, FastAPI, Docker}
\\begin{itemize}
  \\item Developed an asynchronous Python service implementing a two-phase data pipeline (Fact Extraction $\\rightarrow$ Memory Reconciliation with contradiction resolution), cutting prompt token waste by 90\\% and retrieval latency by 91\\%.
\\end{itemize}

\\project{RAG Indirect Prompt Injection \\& Three-Tier Defense Audit}{Python, PyTest, XML Spotlighting, Security Heuristics}
\\begin{itemize}
  \\item Designed a defense-in-depth security framework with automated PyTest test suites; dropped successful prompt injections from 10/10 to 0/10 with 0 false blocks across clean queries (1.8\\,ms average latency overhead).
\\end{itemize}

\\project{Semantic Cache for FAQ \\& Analytics Bots}{Python, NumPy, Multilingual Embeddings, Redis}
\\begin{itemize}
  \\item Built high-speed caching middleware in Python; achieved 38.3\\% cache hit rate with 0 false hits, reducing external API calls by 38.3\\% and request latency from 67.4\\,ms to 13.1\\,ms through vector normalization and Negation Guards.
\\end{itemize}

%---------- TECHNICAL SKILLS ----------
\\section*{Technical Skills}
\\begin{itemize}[leftmargin=0pt, label={}, itemsep=0.8pt]
  \\item \\textbf{Core Languages \\& Fundamentals:} Python (OOP, Design Patterns, Data Structures, Multithreading, Concurrency, Asyncio), SQL, Shell Scripting
  \\item \\textbf{Frameworks \\& APIs:} Django, Django REST Framework (DRF), FastAPI, Flask, RESTful API Design, WebSockets, ORM (Django ORM, SQLAlchemy)
  \\item \\textbf{Async Processing \\& Caching:} RabbitMQ, Celery, Redis (Cache, Pub/Sub), Background Task Queues, Latency Tuning, Idempotent Processing
  \\item \\textbf{Databases \\& Optimization:} PostgreSQL, MySQL, MongoDB, Database Indexing, Query Plan Analysis (EXPLAIN ANALYZE), Connection Pooling
  \\item \\textbf{Testing, DevOps \\& Tools:} PyTest, Unittest, TDD (90\\%+ coverage), Docker, CI/CD Pipelines, Git/GitHub, Nginx, Postman, Linux/Bash
\\end{itemize}

%---------- EDUCATION ----------
\\section*{Education}
\\textbf{Chitkara University}, Chandigarh --- Master of Computer Applications (MCA) \\hfill 2022 -- 2024\\\\[1pt]
\\textbf{The Bhopal School of Social Sciences (BSSS)}, Bhopal --- Bachelor of Computer Applications (BCA) \\hfill 2019 -- 2022

\\end{document}
`;

  // 2. Compile via TexLive API and enforce 1-page format
  console.log("2. Compiling LaTeX to PDF via TexLive API...");
  const initialPdf = await compileLatex(rawLatex);
  const { pdf: singlePagePdf, pages } = await ensureSinglePage(rawLatex, initialPdf);
  console.log(`Successfully produced single-page PDF with ${pages} page(s).`);

  // ONLY save the single final PDF to Downloads
  const latexPdfOut = path.join(downloadsDir, "Abhishek_Tiwari_Tailored_Resume.pdf");
  fs.writeFileSync(latexPdfOut, singlePagePdf);
  console.log(`-> Saved Resume PDF: ${latexPdfOut} (${singlePagePdf.length} bytes)`);

  const resumePdfOut = path.join(downloadsDir, "Abhishek_Tiwari_Resume.pdf");
  fs.writeFileSync(resumePdfOut, singlePagePdf);
  console.log(`-> Saved Resume PDF: ${resumePdfOut} (${singlePagePdf.length} bytes)`);

  console.log("=== Pipeline execution completed! ===");

  // Automatically blank out rawJD in this file after generation
  try {
    const selfPath = __filename;
    const fileText = fs.readFileSync(selfPath, "utf-8");
    const updatedText = fileText.replace(
      /const rawJD = `[\s\S]*?`;/,
      "const rawJD = ``;"
    );
    fs.writeFileSync(selfPath, updatedText, "utf-8");
    console.log("-> Automatically blanked out JD in script (ready for next JD).");
  } catch (cleanErr) {
    console.warn("Could not auto-blank JD:", cleanErr);
  }
}

main().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
});
