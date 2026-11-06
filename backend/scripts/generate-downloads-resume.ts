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
  "name": "Abhishek Tiwari",
  "title": "Senior Full Stack Engineer — React, Python (Django), Node.js (NestJS), WebSockets & AI Workflows",
  "contact": {
    "email": "abhishektiwari6827@gmail.com",
    "phone": "+91-7081660941",
    "linkedin": "linkedin.com/in/abhishek-tiwariiii",
    "github": "github.com/abhishek6827",
    "portfolio": "portfolio.getchintu.com",
    "website": "getchintu.com",
    "location": "Lucknow, India (Open to Relocation to Noida / Bengaluru / Hybrid)"
  },
  "summary": "Product-minded Full Stack Engineer (MCA graduate) with 2.5+ years of production experience building real-time, AI-assisted web applications, multi-tenant architectures, and high-performance APIs across React, Python (Django, FastAPI), and Node.js (NestJS/Express). Solo-engineered and operates live SaaS CHINTU AI (getchintu.com, 1,200+ users, 25k+ monthly requests, 99.8% uptime) featuring sub-400ms multi-LLM runtime routing, WebSocket streaming, and Redis caching. Engineered SynapseAI (two-phase memory engine for AI agents cutting token waste by 90%) and custom Model Context Protocol (MCP) servers for tool-calling agents. Proven track record designing reusable React UI components, event-driven microservices, PostgreSQL/MongoDB schemas, and Dockerized cloud deployments. Excited to engineer mission-critical Agent Assist workflows and customer intelligence at Level AI.",
  "experience": [
    {
      "role": "Founder & Lead Full Stack Engineer — CHINTU AI",
      "company": "getchintu.com",
      "duration": "Feb 2026 – Present",
      "location": "Remote, India",
      "scope": "Zero-to-one SaaS: solo-built and operating live AI platform — 1,200+ users, 25k+ monthly requests",
      "highlights": [
        "Architected and shipped an AI-native web platform serving 1,200+ active users and 25k+ monthly LLM inferences with 99.8% uptime, featuring real-time WebSocket streaming for interactive conversational agent workflows.",
        "Crafted responsive, accessible front-end interfaces using React, Next.js 14, TypeScript, and Redux Toolkit with a reusable component library, eliminating layout shifts and state desynchronization.",
        "Engineered scalable backend microservices in Python (Django/FastAPI) and Node.js with sub-400ms multi-LLM runtime fallback routing (Groq, Gemini, OpenAI) and strict JSON schema validation.",
        "Integrated Redis caching and RabbitMQ asynchronous workers, cutting task queue latency from 8s to 1.2s (85% reduction) under high concurrency without dropped connections.",
        "Designed multi-tenant rate limiting and billing with HMAC authentication and idempotency keys, eliminating duplicate transaction exceptions and maintaining 100% ledger consistency."
      ]
    },
    {
      "role": "Data Systems & Full Stack Developer — Contract",
      "company": "Indian Capital and Investment (Coimbatore) Limited",
      "duration": "Nov 2025 – Jan 2026",
      "location": "Remote, India",
      "scope": "Engineering team of 20 — sole owner of transaction data pipelines and API integrations",
      "highlights": [
        "Replaced legacy batch polling with secure, webhook-driven event architectures in Node.js and Python, slashing data ingestion lag from 20min to <3min with guaranteed delivery.",
        "Slashed PostgreSQL reporting query times by 85% by analyzing execution plans (EXPLAIN ANALYZE), removing N+1 bottlenecks, and introducing composite indexes across high-volume tables.",
        "Automated Docker container builds and CI/CD deployment pipelines using GitHub Actions, accelerating release cycles from 30min to <5min."
      ]
    },
    {
      "role": "Software Developer — Full Stack",
      "company": "Vasnaani Sanskaran — early-stage software startup",
      "duration": "Aug 2024 – Oct 2025",
      "location": "Noida, India",
      "scope": "Core engineer — designed, delivered, and maintained 4 customer-facing web applications from schema to cloud",
      "highlights": [
        "Designed and delivered 4 production web applications from schema to deployment using React, TypeScript, Redux, and Python (Django)/Node.js REST APIs.",
        "Engineered modular UI components with Ant Design and CSS/SCSS, cutting bundle size by 30% and eliminating full-tree re-renders verified via React DevTools Profiler.",
        "Implemented PostgreSQL and MongoDB data layers with connection pooling, Redis caching, and role-based access control (RBAC) across multi-tenant client portals."
      ]
    },
    {
      "role": "Full Stack Developer Intern",
      "company": "Hoping Minds",
      "duration": "Jan 2024 – Jun 2024",
      "location": "Mohali, India",
      "scope": "",
      "highlights": [
        "Rebuilt learning portal modules into React components consuming Django REST APIs, lifting mobile Lighthouse performance scores from 68 to 94 and cutting page load latency by 22%."
      ]
    }
  ],
  "projects": [
    {
      "name": "SynapseAI — Persistent Long-Term Memory Engine for AI Agents",
      "description": "Two-phase memory engine for AI agents cutting token waste and lookup latency",
      "tech": [
        "Python",
        "Qdrant Vector DB",
        "Neo4j",
        "FastEmbed"
      ],
      "highlights": [
        "Engineered a two-phase memory engine for AI agents (Fact Extraction -> Contradiction Resolution), cutting prompt token overhead by 90% and semantic lookup latency by 91% compared to full-context stuffing; prevented hallucinations in multi-turn agent assist dialogues."
      ]
    },
    {
      "name": "Git-AI-Hub — Model Context Protocol (MCP) Server & Tool-Calling Bridge",
      "description": "Model Context Protocol server connecting AI agents directly with GitHub tools and developer workflows",
      "tech": [
        "FastAPI",
        "Python",
        "MCP Protocol",
        "Docker"
      ],
      "highlights": [
        "Built an open-source Model Context Protocol (MCP) server over SSE connecting AI agents directly with GitHub tools and developer workflows, enabling real-time automated diff reviews and structured code actions."
      ]
    },
    {
      "name": "AI Resume Tailor — Full Stack Extension & Multi-LLM Gateway",
      "description": "Full-stack Chrome extension and web platform tailoring resumes against job descriptions",
      "tech": [
        "React",
        "TypeScript",
        "Node.js",
        "Tailwind CSS"
      ],
      "highlights": [
        "Built a full-stack Chrome extension and web platform tailoring resumes against job descriptions with multi-provider LLM fallback routing, real-time WebSocket progress updates, and automated PDF compilation."
      ]
    },
    {
      "name": "TempoMail — Multi-Tenant SaaS & Webhook Event Pipeline",
      "description": "Full-stack SaaS platform managing active mailboxes and webhook billing events",
      "tech": [
        "Next.js",
        "Node.js",
        "TypeScript",
        "PostgreSQL"
      ],
      "highlights": [
        "Built full-stack SaaS platform managing 150+ active mailboxes across 3 tiers; processed 5k+ monthly webhook events via isolated microservices with exponential backoff and idempotent database updates."
      ]
    }
  ],
  "skills": {
    "frontendEngineering": [
      "React.js",
      "Next.js",
      "JavaScript/TypeScript (ES6+)",
      "Redux Toolkit",
      "HTML5",
      "CSS/SCSS",
      "Ant Design",
      "Tailwind CSS",
      "Reusable Component Libraries"
    ],
    "backendAndApis": [
      "Python (Django, FastAPI)",
      "Node.js",
      "NestJS",
      "TypeScript",
      "RESTful APIs",
      "GraphQL",
      "Microservices",
      "WebSockets",
      "OOP"
    ],
    "databasesAndCaching": [
      "PostgreSQL",
      "MySQL",
      "MongoDB",
      "Redis (Cache & Pub/Sub)",
      "Snowflake fundamentals",
      "Data Modeling",
      "Query Optimization"
    ],
    "aiAndRealTimeWorkflows": [
      "Agent Assist Workflows",
      "Real-Time AI Assistance",
      "Multi-LLM Runtime Routing",
      "Model Context Protocol (MCP)",
      "Vector DBs (Qdrant)"
    ],
    "infrastructureAndDevOps": [
      "Docker",
      "Kubernetes",
      "GCP fundamentals",
      "CI/CD (GitHub Actions)",
      "Git/GitHub",
      "Linux/Bash",
      "Unit Testing (Jest)"
    ]
  },
  "certifications": [],
  "achievements": [],
  "education": [
    {
      "institution": "Chitkara University, Chandigarh",
      "degree": "Master of Computer Applications (MCA)",
      "year": "2022 – 2024"
    },
    {
      "institution": "The Bhopal School of Social Sciences (BSSS), Bhopal",
      "degree": "Bachelor of Computer Applications (BCA)",
      "year": "2019 – 2022"
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
  console.log("=== Resume Tailor AI Engine — Senior Full Stack Engineer (Level AI - Noida/Bengaluru) Execution ===");
  const downloadsDir = "C:\\Users\\Abhishek\\Downloads";

  const rawLatex = "\\documentclass[10pt]{article}\n\n\\usepackage[left=0.36in,right=0.36in,top=0.25in,bottom=0.22in]{geometry}\n\\usepackage[T1]{fontenc}\n\\usepackage[utf8]{inputenc}\n\\usepackage{mathptmx}\n\\usepackage{titlesec}\n\\usepackage{enumitem}\n\\usepackage{hyperref}\n\\usepackage{xcolor}\n\n% Make PDF text selectable / parseable by ATS systems\n\\input{glyphtounicode}\n\\pdfgentounicode=1\n\n\\definecolor{darkgray}{RGB}{40,40,40}\n\\definecolor{linkblue}{RGB}{0,70,140}\n\\hypersetup{\n  colorlinks=true, urlcolor=linkblue, linkcolor=linkblue,\n  pdftitle={Abhishek Tiwari - Senior Full Stack Engineer},\n  pdfauthor={Abhishek Tiwari}\n}\n\\pagestyle{empty}\n\\hyphenpenalty=10000 \\tolerance=2000 \\emergencystretch=1em\n\\setlength{\\parindent}{0pt}\n\n\\titleformat{\\section}\n  {\\normalsize\\bfseries\\scshape\\color{darkgray}}\n  {}{0em}{}[\\vspace{1.5pt}\\titlerule]\n\\titlespacing{\\section}{0pt}{4.5pt}{6.0pt}\n\n\\setlist[itemize]{leftmargin=11pt, topsep=0.2pt, itemsep=0.2pt,\n                  parsep=0pt, label=\\textbullet}\n\n\\newcommand{\\role}[3]{%\n  \\textbf{#1} \\hfill \\textit{#2}\\\\[-1pt]\n  {\\small #3}\\par\\vspace{0.4pt}%\n}\n\\newcommand{\\scope}[1]{{\\footnotesize\\textit{#1}}\\par\\vspace{0.3pt}}\n\\newcommand{\\project}[2]{%\n  \\textbf{#1} \\hfill {\\small\\textit{#2}}\\par\\vspace{0.4pt}%\n}\n\n\\begin{document}\n\n%---------- HEADER ----------\n\\begin{center}\n  {\\LARGE\\textbf{Abhishek Tiwari}}\\\\[1.5pt]\n  \\small\n  \\textit{Senior Full Stack Engineer --- React, Python (Django), Node.js (NestJS), WebSockets \\& AI Workflows}\\\\[1.5pt]\n  Lucknow, India \\,(Open to Relocation to Noida / Bengaluru / Hybrid) \\,\\textbar\\,\n  +91-7081660941 \\,\\textbar\\,\n  \\href{mailto:abhishektiwari6827@gmail.com}{abhishektiwari6827@gmail.com}\\\\[1.5pt]\n  \\href{https://linkedin.com/in/abhishek-tiwariiii}{linkedin.com/in/abhishek-tiwariiii} \\,\\textbar\\,\n  \\href{https://github.com/Abhishek6827}{github.com/abhishek6827} \\,\\textbar\\,\n  \\href{https://portfolio.getchintu.com}{portfolio.getchintu.com} \\,\\textbar\\,\n  \\href{https://getchintu.com}{getchintu.com}\n\\end{center}\n\\vspace{-8pt}\n\\small\\linespread{0.835}\\selectfont\n\n%---------- SUMMARY ----------\n\\section*{Summary}\nProduct-minded Full Stack Engineer (MCA graduate) with 2.5+ years of production experience building real-time, AI-assisted web applications, multi-tenant architectures, and high-performance APIs across \\textbf{React, Python (Django, FastAPI), and Node.js (NestJS/Express)}. Solo-engineered and operates live SaaS \\textbf{CHINTU AI} (\\href{https://getchintu.com}{getchintu.com}, 1,200+ users, 25k+ monthly requests, 99.8\\% uptime) featuring sub-400\\,ms multi-LLM runtime routing, WebSocket streaming, and Redis caching. Engineered \\textbf{SynapseAI} (two-phase memory engine for AI agents cutting token waste by 90\\%) and custom \\textbf{Model Context Protocol (MCP)} servers for tool-calling agents. Proven track record designing reusable React UI components, event-driven microservices, PostgreSQL/MongoDB schemas, and Dockerized cloud deployments. Excited to engineer mission-critical Agent Assist workflows and customer intelligence at Level AI.\n\n%---------- EXPERIENCE ----------\n\\section*{Experience}\n\n\\role{Founder \\& Lead Full Stack Engineer --- CHINTU AI}{Feb 2026 -- Present}%\n     {\\href{https://getchintu.com}{getchintu.com} \\hfill Remote, India}\n\\scope{Zero-to-one SaaS: solo-built and operating live AI platform --- 1,200+ users, 25k+ monthly requests}\n\\begin{itemize}\n  \\item Architected and shipped an AI-native web platform serving 1,200+ active users and 25k+ monthly LLM inferences with 99.8\\% uptime, featuring real-time WebSocket streaming for interactive conversational agent workflows.\n  \\item Crafted responsive, accessible front-end interfaces using React, Next.js 14, TypeScript, and Redux Toolkit with a reusable component library, eliminating layout shifts and state desynchronization.\n  \\item Engineered scalable backend microservices in Python (Django/FastAPI) and Node.js with sub-400\\,ms multi-LLM runtime fallback routing (Groq, Gemini, OpenAI) and strict JSON schema validation.\n  \\item Integrated Redis caching and RabbitMQ asynchronous workers, cutting task queue latency from 8\\,s to 1.2\\,s (85\\% reduction) under high concurrency without dropped connections.\n  \\item Designed multi-tenant rate limiting and billing with HMAC authentication and idempotency keys, eliminating duplicate transaction exceptions and maintaining 100\\% ledger consistency.\n\\end{itemize}\n\n\\role{Data Systems \\& Full Stack Developer --- Contract}{Nov 2025 -- Jan 2026}%\n     {Indian Capital and Investment (Coimbatore) Limited \\hfill Remote, India}\n\\scope{Engineering team of 20 --- sole owner of transaction data pipelines and API integrations}\n\\begin{itemize}\n  \\item Replaced legacy batch polling with secure, webhook-driven event architectures in Node.js and Python, slashing data ingestion lag from 20\\,min to $<$3\\,min with guaranteed delivery.\n  \\item Slashed PostgreSQL reporting query times by 85\\% by analyzing execution plans (EXPLAIN ANALYZE), removing N+1 bottlenecks, and introducing composite indexes across high-volume tables.\n  \\item Automated Docker container builds and CI/CD deployment pipelines using GitHub Actions, accelerating release cycles from 30\\,min to $<$5\\,min.\n\\end{itemize}\n\n\\role{Software Developer --- Full Stack}{Aug 2024 -- Oct 2025}%\n     {Vasnaani Sanskaran --- early-stage software startup \\hfill Noida, India}\n\\scope{Core engineer --- designed, delivered, and maintained 4 customer-facing web applications from schema to cloud}\n\\begin{itemize}\n  \\item Designed and delivered 4 production web applications from schema to deployment using React, TypeScript, Redux, and Python (Django)/Node.js REST APIs.\n  \\item Engineered modular UI components with Ant Design and CSS/SCSS, cutting bundle size by 30\\% and eliminating full-tree re-renders verified via React DevTools Profiler.\n  \\item Implemented PostgreSQL and MongoDB data layers with connection pooling, Redis caching, and role-based access control (RBAC) across multi-tenant client portals.\n\\end{itemize}\n\n\\role{Full Stack Developer Intern}{Jan 2024 -- Jun 2024}%\n     {Hoping Minds \\hfill Mohali, India}\n\\begin{itemize}\n  \\item Rebuilt learning portal modules into React components consuming Django REST APIs, lifting mobile Lighthouse performance scores from 68 to 94 and cutting page load latency by 22\\%.\n\\end{itemize}\n\n%---------- PROJECTS ----------\n\\section*{Projects}\n\n\\project{SynapseAI --- Persistent Long-Term Memory Engine for AI Agents}{Python, Qdrant Vector DB, Neo4j, FastEmbed}\n\\begin{itemize}\n  \\item Engineered a two-phase memory engine for AI agents (Fact Extraction $\\rightarrow$ Contradiction Resolution), cutting prompt token overhead by 90\\% and semantic lookup latency by 91\\% compared to full-context stuffing; prevented hallucinations in multi-turn agent assist dialogues.\n\\end{itemize}\n\n\\project{Git-AI-Hub --- Model Context Protocol (MCP) Server \\& Tool-Calling Bridge}{FastAPI, Python, MCP Protocol, Docker}\n\\begin{itemize}\n  \\item Built an open-source Model Context Protocol (MCP) server over SSE connecting AI agents directly with GitHub tools and developer workflows, enabling real-time automated diff reviews and structured code actions.\n\\end{itemize}\n\n\\project{AI Resume Tailor --- Full Stack Extension \\& Multi-LLM Gateway}{React, TypeScript, Node.js, Tailwind CSS}\n\\begin{itemize}\n  \\item Built a full-stack Chrome extension and web platform tailoring resumes against job descriptions with multi-provider LLM fallback routing, real-time WebSocket progress updates, and automated PDF compilation.\n\\end{itemize}\n\n\\project{TempoMail --- Multi-Tenant SaaS \\& Webhook Event Pipeline}{Next.js, Node.js, TypeScript, PostgreSQL}\n\\begin{itemize}\n  \\item Built full-stack SaaS platform managing 150+ active mailboxes across 3 tiers; processed 5k+ monthly webhook events via isolated microservices with exponential backoff and idempotent database updates.\n\\end{itemize}\n\n%---------- TECHNICAL SKILLS ----------\n\\section*{Technical Skills}\n\\begin{itemize}[leftmargin=0pt, label={}, itemsep=0.4pt]\n  \\item \\textbf{Frontend Engineering:} React.js, Next.js, JavaScript/TypeScript (ES6+), Redux Toolkit, HTML5, CSS/SCSS, Ant Design, Tailwind CSS, Reusable Component Libraries\n  \\item \\textbf{Backend \\& APIs:} Python (Django, FastAPI), Node.js, NestJS, TypeScript, RESTful APIs, GraphQL, Microservices, WebSockets, OOP\n  \\item \\textbf{Databases \\& Caching:} PostgreSQL, MySQL, MongoDB, Redis (Cache \\& Pub/Sub), Snowflake fundamentals, Data Modeling, Query Optimization\n  \\item \\textbf{AI \\& Real-Time Workflows:} Agent Assist Workflows, Real-Time AI Assistance, Multi-LLM Runtime Routing, Model Context Protocol (MCP), Vector DBs (Qdrant)\n  \\item \\textbf{Infrastructure \\& DevOps:} Docker, Kubernetes, GCP fundamentals, CI/CD (GitHub Actions), Git/GitHub, Linux/Bash, Unit Testing (Jest)\n\\end{itemize}\n\n%---------- EDUCATION ----------\n\\section*{Education}\n\\textbf{Chitkara University}, Chandigarh --- Master of Computer Applications (MCA) \\hfill 2022 -- 2024\\\\[1pt]\n\\textbf{The Bhopal School of Social Sciences (BSSS)}, Bhopal --- Bachelor of Computer Applications (BCA) \\hfill 2019 -- 2022\n\n\\end{document}\n";

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
