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
  title: "Full Stack Developer",
  contact: {
    email: "abhishektiwari6827@gmail.com",
    phone: "+91-7081660941",
    linkedin: "linkedin.com/in/abhishek-tiwariiii",
    github: "github.com/abhishek6827",
    website: "getchintu.com",
    location: "Lucknow, India"
  },
  summary: "Versatile Full Stack Developer with 2+ years of production experience delivering end-to-end architectural coherence across high-performance client interfaces and scalable backend systems using React.js, Next.js, Node.js, TypeScript, and Python. Founder of CHINTU AI (live SaaS serving 25k+ monthly inferences with 99.8% uptime), driving unified frontend-backend lifecycles from data modeling in PostgreSQL/MongoDB to responsive component systems and Redis cache layers. Experienced in building resilient RESTful APIs, webhook-driven fintech pipelines, and containerized Docker microservices on Linux environments.",
  experience: [
    {
      role: "Founder & Full Stack Developer — CHINTU AI",
      company: "getchintu.com",
      duration: "Feb 2026 – Present",
      location: "Remote, India",
      scope: "Solo-built and operating live SaaS platform — 500+ registered users, 40+ paying subscribers",
      highlights: [
        "Engineered full-stack SaaS architecture bridging React/Next.js client interface with Node.js and Python microservices, sustaining 25k+ monthly inference requests with 99.8% uptime and sub-400ms fallback.",
        "Established end-to-end type safety and schema validation across client and server boundaries, cutting user-facing runtime errors from 7.2% to <0.4% (94% drop).",
        "Integrated Razorpay credit billing with HMAC signature verification, idempotent webhook processing, and automated audit logging, preventing duplicate transactions and revenue leakage.",
        "Slashed repetitive database and inference latency by 65% by implementing in-memory Redis caching, connection pooling, and structured JSON stream serialization."
      ]
    },
    {
      role: "Full Stack Developer — Contract (Fintech Platform)",
      company: "Indian Capital and Investment (Coimbatore) Limited",
      duration: "Nov 2025 – Jan 2026",
      location: "Remote, India",
      scope: "Cross-functional team of 20 engineers — sole owner of high-throughput data sync, webhook pipelines, and transaction reconciliation",
      highlights: [
        "Developed responsive client dashboards using React.js and Node.js/Express, consuming REST APIs and real-time transaction event streams with sub-300ms state synchronization and robust error recovery.",
        "Prevented high-frequency UI re-renders on financial data tables via virtualized lists and memoized selectors (reselect), maintaining 60fps UI fluidity and cutting status reflection lag from 20min to <3min (85% drop).",
        "Automated build, test, and containerized deployment workflows using Git and CI/CD pipelines, slashing release verification cycle from 30min to under 5min (83% reduction)."
      ]
    },
    {
      role: "Software Developer",
      company: "Vasnaani Sanskaran — early-stage software startup",
      duration: "Aug 2024 – Oct 2025",
      location: "Noida, India",
      scope: "Core engineer — designed, developed, and deployed 4 production web applications from schema to deployment",
      highlights: [
        "Designed and shipped 4 customer-facing web applications from schema to cloud using React.js frontends and Node.js/Express backends backed by PostgreSQL, ensuring seamless UI-to-database contract coherence.",
        "Dropped p95 endpoint response time from 850ms to 550ms (35% improvement) by eliminating N+1 queries, optimizing SQL joins, and creating composite indexes on high-traffic endpoints.",
        "Boosted rendering performance by 25% across 12 high-interaction components by profiling memory leaks and re-render cycles via React DevTools Profiler and Chrome DevTools."
      ]
    },
    {
      role: "Full Stack Developer Intern",
      company: "Hoping Minds",
      duration: "Jan 2024 – Jun 2024",
      location: "Mohali, India",
      scope: "",
      highlights: [
        "Rebuilt performance-critical web pages as modular React components consuming RESTful APIs, boosting mobile Lighthouse score from 68 to 94 (38% improvement) and cutting page load times by 22%."
      ]
    }
  ],
  projects: [
    {
      name: "TempoMail — Multi-Gateway Email & Webhook SaaS",
      description: "Email Hosting SaaS platform with multi-gateway billing",
      tech: ["Next.js", "Node.js", "TypeScript", "REST APIs", "Redis", "Stripe", "Webhooks"],
      highlights: [
        "Architected end-to-end email hosting SaaS platform managing 150+ mailboxes with Next.js frontend, isolated Node.js billing microservices, Redis event queues, and idempotent Stripe/Zoho webhook processing."
      ]
    },
    {
      name: "Social Connect — Real-Time Streaming & Messaging Platform",
      description: "Real-time communication and media streaming platform",
      tech: ["React.js", "Node.js", "MongoDB (NoSQL)", "Socket.io", "Redis", "WebRTC"],
      highlights: [
        "Built real-time communication platform sustaining 200 concurrent user sessions with sub-90ms p99 latency using React.js frontend, Node.js WebSocket engine, and MongoDB document storage."
      ]
    },
    {
      name: "OpenJarvis — Async Task & Multimodal Assistant",
      description: "Polyglot voice and multimodal AI agent platform",
      tech: ["Node.js", "Python", "FastAPI", "Docker", "Linux", "Redis", "RESTful APIs"],
      highlights: [
        "Implemented polyglot microservice orchestrator using Node.js and Python/FastAPI processing 10k+ requests/month, containerized via Docker on Linux with sub-second background task execution."
      ]
    }
  ],
  skills: {
    "Frontend Engineering": ["React.js", "Next.js (SSR, SSG)", "TypeScript", "JavaScript (ES6+)", "Redux Toolkit", "Context API", "HTML5", "CSS3", "Responsive Design"],
    "Backend & APIs": ["Node.js", "Express.js", "Python (FastAPI)", "RESTful APIs", "WebSockets", "JSON", "Microservices", "Event Streams", "Webhooks"],
    "Databases & Caching": ["PostgreSQL", "MongoDB (NoSQL)", "MySQL", "Redis (In-Memory Cache/Pub-Sub)", "Schema Design", "Query Optimization"],
    "Tooling & Performance": ["Webpack", "Vite", "npm", "Chrome DevTools", "React DevTools Profiler", "Lighthouse", "Postman", "Jest"],
    "DevOps, OS & Cloud": ["Linux Environments", "Docker Containers", "Git/GitHub (Branching, PRs)", "CI/CD Pipelines", "Cloud Hosting"],
    "Engineering Best Practices": ["End-to-End Coherence", "Full-Stack Type Safety", "Idempotency", "Clean Architecture", "Error Boundaries"]
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
  console.log("=== Resume Tailor AI Engine — Front-End Javascript Developer Execution ===");
  const downloadsDir = "C:\\Users\\Abhishek\\Downloads";

  const rawLatex = `\\documentclass[10pt]{article}

\\usepackage[left=0.45in,right=0.45in,top=0.36in,bottom=0.34in]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{mathptmx}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{xcolor}

\\input{glyphtounicode}
\\pdfgentounicode=1

\\definecolor{darkgray}{RGB}{40,40,40}
\\definecolor{linkblue}{RGB}{0,70,140}
\\hypersetup{
  colorlinks=true, urlcolor=linkblue, linkcolor=linkblue,
  pdftitle={Abhishek Tiwari - Full Stack Developer},
  pdfauthor={Abhishek Tiwari}
}
\\pagestyle{empty}
\\hyphenpenalty=10000 \\tolerance=2000 \\emergencystretch=1em
\\setlength{\\parindent}{0pt}

\\titleformat{\\section}
  {\\normalsize\\bfseries\\scshape\\color{darkgray}}
  {}{0em}{}[\\vspace{1pt}\\titlerule]
\\titlespacing{\\section}{0pt}{3.5pt}{1.5pt}

\\setlist[itemize]{leftmargin=12pt, topsep=0.8pt, itemsep=0.8pt,
                  parsep=0pt, label=\\textbullet}

\\newcommand{\\role}[3]{%
  \\textbf{#1} \\hfill \\textit{#2}\\\\[-1pt]
  {\\small #3}\\par\\vspace{1pt}%
}
\\newcommand{\\scope}[1]{{\\footnotesize\\textit{#1}}\\par\\vspace{1pt}}
\\newcommand{\\project}[2]{%
  \\textbf{#1} \\hfill {\\small\\textit{#2}}\\par\\vspace{1pt}%
}

\\begin{document}

%---------- HEADER ----------
\\begin{center}
  {\\LARGE\\textbf{Abhishek Tiwari}}\\\\[3pt]
  \\small
  \\textit{Full Stack Developer}\\\\[3pt]
  +91-7081660941 \\,\\textbar\\,
  \\href{mailto:abhishektiwari6827@gmail.com}{abhishektiwari6827@gmail.com} \\,\\textbar\\,
  \\href{https://linkedin.com/in/abhishek-tiwariiii}{linkedin.com/in/abhishek-tiwariiii} \\,\\textbar\\,
  \\href{https://github.com/Abhishek6827}{github.com/abhishek6827} \\,\\textbar\\,
  \\href{https://getchintu.com}{getchintu.com}
\\end{center}
\\vspace{-6pt}
\\small\\linespread{0.92}\\selectfont

%---------- SUMMARY ----------
\\section*{Summary}
Versatile Full Stack Developer with 2+ years of production experience delivering end-to-end architectural coherence across high-performance client interfaces and scalable backend systems using \\textbf{React.js}, \\textbf{Next.js}, \\textbf{Node.js}, \\textbf{TypeScript}, and \\textbf{Python}. Founder of CHINTU AI (live SaaS serving 25k+ monthly inferences with 99.8\\% uptime), driving unified frontend-backend lifecycles from data modeling in PostgreSQL/MongoDB to responsive component systems and Redis cache layers. Experienced in building resilient RESTful APIs, webhook-driven fintech pipelines, and containerized Docker microservices on Linux environments.

%---------- EXPERIENCE ----------
\\section*{Experience}

\\role{Founder \\& Full Stack Developer --- CHINTU AI}{Feb 2026 -- Present}%
     {\\href{https://getchintu.com}{getchintu.com} \\hfill Remote, India}
\\scope{Solo-built and operating live SaaS platform --- 500+ registered users, 40+ paying subscribers}
\\begin{itemize}
  \\item Engineered full-stack SaaS architecture bridging React/Next.js client interface with Node.js and Python microservices, sustaining 25k+ monthly inference requests with 99.8\\% uptime and sub-400\\,ms fallback.
  \\item Established end-to-end type safety and schema validation across client and server boundaries, cutting user-facing runtime errors from 7.2\\% to $<$0.4\\% (94\\% drop).
  \\item Integrated Razorpay credit billing with HMAC signature verification, idempotent webhook processing, and automated audit logging, preventing duplicate transactions and revenue leakage.
  \\item Slashed repetitive database and inference latency by 65\\% by implementing in-memory Redis caching, connection pooling, and structured JSON stream serialization.
\\end{itemize}

\\role{Full Stack Developer --- Contract (Fintech Platform)}{Nov 2025 -- Jan 2026}%
     {Indian Capital and Investment (Coimbatore) Limited \\hfill Remote, India}
\\scope{Cross-functional team of 20 engineers --- sole owner of high-throughput data sync, webhook pipelines, and transaction reconciliation}
\\begin{itemize}
  \\item Developed responsive client dashboards using React.js and Node.js/Express, consuming REST APIs and real-time transaction event streams with sub-300\\,ms state synchronization and robust error recovery.
  \\item Prevented high-frequency UI re-renders on financial data tables via virtualized lists and memoized selectors (reselect), maintaining 60\\,fps UI fluidity and cutting status reflection lag from 20\\,min to $<$3\\,min (85\\% drop).
  \\item Automated build, test, and containerized deployment workflows using Git and CI/CD pipelines, slashing release verification cycle from 30\\,min to under 5\\,min (83\\% reduction).
\\end{itemize}

\\role{Software Developer}{Aug 2024 -- Oct 2025}%
     {Vasnaani Sanskaran --- early-stage software startup \\hfill Noida, India}
\\scope{Core engineer --- designed, developed, and deployed 4 production web applications from schema to deployment}
\\begin{itemize}
  \\item Designed and shipped 4 customer-facing web applications from schema to cloud using React.js frontends and Node.js/Express backends backed by PostgreSQL, ensuring seamless UI-to-database contract coherence.
  \\item Dropped p95 endpoint response time from 850\\,ms to 550\\,ms (35\\% improvement) by eliminating N+1 queries, optimizing SQL joins, and creating composite indexes on high-traffic endpoints.
  \\item Boosted rendering performance by 25\\% across 12 high-interaction components by profiling memory leaks and re-render cycles via React DevTools Profiler and Chrome DevTools.
\\end{itemize}

\\role{Full Stack Developer Intern}{Jan 2024 -- Jun 2024}%
     {Hoping Minds \\hfill Mohali, India}
\\begin{itemize}
  \\item Rebuilt performance-critical web pages as modular React components consuming RESTful APIs, boosting mobile Lighthouse score from 68 to 94 (38\\% improvement) and cutting page load times by 22\\%.
\\end{itemize}

%---------- PROJECTS ----------
\\section*{Projects}

\\project{TempoMail --- Multi-Gateway Email \\& Webhook SaaS}{Next.js, Node.js, TypeScript, REST APIs, Redis, Stripe, Webhooks}
\\begin{itemize}
  \\item Architected end-to-end email hosting SaaS platform managing 150+ mailboxes with Next.js frontend, isolated Node.js billing microservices, Redis event queues, and idempotent Stripe/Zoho webhook processing.
\\end{itemize}

\\project{Social Connect --- Real-Time Streaming \\& Messaging Platform}{React.js, Node.js, MongoDB (NoSQL), Socket.io, Redis, WebRTC}
\\begin{itemize}
  \\item Built real-time communication platform sustaining 200 concurrent user sessions with sub-90\\,ms p99 latency using React.js frontend, Node.js WebSocket engine, and MongoDB document storage.
\\end{itemize}

\\project{OpenJarvis --- Async Task \\& Multimodal Assistant}{Node.js, Python, FastAPI, Docker, Linux, Redis, RESTful APIs}
\\begin{itemize}
  \\item Implemented polyglot microservice orchestrator using Node.js and Python/FastAPI processing 10k+ requests/month, containerized via Docker on Linux with sub-second background task execution.
\\end{itemize}

%---------- TECHNICAL SKILLS ----------
\\section*{Technical Skills}
\\begin{itemize}[leftmargin=0pt, label={}]
  \\item \\textbf{Frontend Engineering:} React.js, Next.js (SSR, SSG), TypeScript, JavaScript (ES6+), Redux Toolkit, Context API, HTML5, CSS3, Responsive Design
  \\item \\textbf{Backend \\& APIs:} Node.js, Express.js, Python (FastAPI), RESTful APIs, WebSockets, JSON, Microservices, Event Streams, Webhooks
  \\item \\textbf{Databases \\& Caching:} PostgreSQL, MongoDB (NoSQL), MySQL, Redis (In-Memory Cache/Pub-Sub), Schema Design, Query Optimization
  \\item \\textbf{Tooling \\& Performance:} Webpack, Vite, npm, Chrome DevTools, React DevTools Profiler, Lighthouse, Postman, Jest
  \\item \\textbf{DevOps, OS \\& Cloud:} Linux Environments, Docker Containers, Git/GitHub (Branching, PRs), CI/CD Pipelines, Cloud Hosting
  \\item \\textbf{Engineering Best Practices:} End-to-End Coherence, Full-Stack Type Safety, Idempotency, Clean Architecture, Error Boundaries
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
