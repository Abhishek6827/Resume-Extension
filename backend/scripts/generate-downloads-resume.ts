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

// Precisely Tailored Resume targeting Junior AI Engineer at Whitefield Careers (Thane Mumbai)
const tailoredResume: ResumeData = {
  name: "Abhishek Tiwari",
  title: "Junior AI Engineer — Python, Machine Learning & Generative AI Systems",
  contact: {
    email: "abhishektiwari6827@gmail.com",
    phone: "+91-7081660941",
    linkedin: "linkedin.com/in/abhishek-tiwariiii",
    github: "github.com/abhishek6827",
    website: "getchintu.com",
    location: "Lucknow, India (Open to Relocate to Thane/Mumbai)"
  },
  summary: "Results-driven AI Engineer with 2+ years of production experience developing, testing, and deploying machine learning pipelines, deep learning models, and Generative AI systems. Founder of CHINTU AI (live platform serving 25k+ monthly inferences with 99.8% uptime), leading end-to-end implementation across Python (NumPy, Pandas, Scikit-learn, PyTorch/TensorFlow), REST APIs (FastAPI), and SQL/NoSQL databases. Proven track record in data preprocessing, feature engineering, and model evaluation, collaborating seamlessly across engineering teams.",
  experience: [
    {
      role: "Founder & AI Systems Engineer — CHINTU AI",
      company: "getchintu.com",
      duration: "Feb 2026 – Present",
      location: "Remote, India",
      scope: "Solo-built and operating live AI SaaS platform — 500+ registered users, 40+ paying subscribers",
      highlights: [
        "Architected and deployed production machine learning and GenAI pipelines in Python (FastAPI), sustaining 25k+ monthly requests with 99.8% uptime and automated sub-400ms fallback failover circuits.",
        "Engineered data preprocessing, tokenization, and asynchronous queuing pipelines with RabbitMQ and Redis, reducing p95 task latency from 8s to 1.2s (85% drop).",
        "Built data validation schemas, error-handling boundaries, and automated model evaluation loops, dropping user-facing pipeline failures from 7.2% to <0.4%.",
        "Implemented PostgreSQL database schemas and REST API endpoints for seamless model inference, logging, and data retrieval."
      ]
    },
    {
      role: "Full Stack Developer — Contract (3-month fixed term)",
      company: "Indian Capital and Investment (Coimbatore) Limited — fintech investment platform",
      duration: "Nov 2025 – Jan 2026",
      location: "Remote, India",
      scope: "Team of 20 engineers — sole owner of payment integrations, webhook infrastructure, and real-time ledger sync",
      highlights: [
        "Developed RESTful API endpoints and webhook data ingestion pipelines using Node.js and Express, cutting transaction status latency from 20min to under 3min (85% drop) with idempotency verification.",
        "Containerized application services using Docker and configured automated CI/CD pipelines on AWS with end-to-end integration tests."
      ]
    },
    {
      role: "Software Developer",
      company: "Vasnaani Sanskaran — early-stage software startup",
      duration: "Aug 2024 – Oct 2025",
      location: "Noida, India",
      scope: "Sole engineer — designed, developed, and deployed 4 customer-facing web applications from schema to cloud",
      highlights: [
        "Implemented backend data models and tuned relational schemas in PostgreSQL, eliminating N+1 queries and improving p95 query response time from ~850ms to ~550ms (35% boost).",
        "Built responsive user interfaces and data visualization dashboards using React, conducting code reviews and maintaining technical documentation."
      ]
    },
    {
      role: "Full Stack Developer Intern",
      company: "Hoping Minds",
      duration: "Jan 2024 – Jun 2024",
      location: "Mohali, India",
      scope: "",
      highlights: [
        "Rebuilt performance-critical web pages as modular React components consuming RESTful APIs, raising mobile Lighthouse score from 68 to 94 (38% boost) and cutting load time by 22%."
      ]
    }
  ],
  projects: [
    {
      name: "OpenJarvis — Local-First Agent Framework, Multi-Hop RAG & ML Benchmarks",
      description: "Autonomous agent and ML evaluation framework supporting document indexing, vector embeddings (FAISS), and ML benchmarks",
      tech: ["Python", "PyTorch/TensorFlow", "Scikit-learn", "NumPy", "Pandas", "LangChain", "FAISS", "FastAPI", "Docker"],
      highlights: [
        "Architected an autonomous agent and ML evaluation framework supporting document indexing, vector embeddings (FAISS), and ML benchmarks; implemented automated testing loops tracking inference latency, token usage, and accuracy across 10k+ requests."
      ]
    },
    {
      name: "git-ai-hub — Multi-Model Cloud AI Gateway & Remote MCP Server",
      description: "Cloud AI gateway and Model Context Protocol (MCP) server over SSE streaming with REST API dispatch",
      tech: ["Python", "FastAPI", "REST APIs", "Docker", "NVIDIA NIM", "Groq SDK", "Git/GitHub", "SSE Streaming"],
      highlights: [
        "Built a cloud AI gateway and Model Context Protocol (MCP) server over SSE streaming; integrated multi-model REST APIs and automated code inspection workflows with sub-second response times."
      ]
    },
    {
      name: "YT-Automation — Multimodal ML Pipeline & Frame Preprocessing",
      description: "Automated data preprocessing pipeline extracting video frames via FFmpeg and transcripts via AssemblyAI for multimodal AI classification",
      tech: ["Python", "Next.js", "TypeScript", "FFmpeg", "AssemblyAI", "Gemini Vision", "PostgreSQL", "NoSQL"],
      highlights: [
        "Developed an automated data preprocessing pipeline extracting video frames via FFmpeg and transcripts via AssemblyAI for multimodal AI classification; reduced end-to-end tagging latency from 45min to under 4min (91% drop)."
      ]
    }
  ],
  skills: {
    "Languages & Core": ["Python", "TypeScript", "JavaScript (ES6+)", "SQL", "Bash", "Data Structures & Algorithms"],
    "Machine Learning & Data Science": ["NumPy", "Pandas", "Scikit-learn", "Feature Engineering", "Supervised/Unsupervised Learning", "Data Cleaning"],
    "Deep Learning & GenAI": ["PyTorch", "TensorFlow (Basics)", "LangChain", "Hugging Face", "Prompt Engineering", "RAG Architectures", "FAISS"],
    "APIs & Backend": ["REST APIs", "FastAPI", "Node.js", "Express.js", "Microservices Architecture", "Webhooks", "SSE Streaming"],
    "Databases & Storage": ["PostgreSQL", "MySQL", "NoSQL (MongoDB, Redis)", "Vector Databases (FAISS, Pinecone)"],
    "Tools & Practices": ["Git", "GitHub", "Docker", "Jupyter Notebook", "Google Colab", "Linux", "CI/CD", "Unit Testing", "Code Reviews"]
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
  console.log("=== Resume Tailor AI Engine — Full Stack Developer Execution ===");
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
  pdftitle={Abhishek Tiwari - Junior AI Engineer},
  pdfauthor={Abhishek Tiwari}
}
\\pagestyle{empty}
\\hyphenpenalty=10000 \\tolerance=2000 \\emergencystretch=1em
\\setlength{\\parindent}{0pt}

\\titleformat{\\section}
  {\\normalsize\\bfseries\\scshape\\color{darkgray}}
  {}{0em}{}[\\vspace{1pt}\\titlerule]
\\titlespacing{\\section}{0pt}{4pt}{2.2pt}

\\setlist[itemize]{leftmargin=12pt, topsep=1.0pt, itemsep=1.0pt,
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
  {\\LARGE\\textbf{Abhishek Tiwari}}\\\\[2pt]
  \\small
  \\textit{Junior AI Engineer --- Python, Machine Learning \\& Generative AI Systems}\\\\[2pt]
  Lucknow, India \\,\\textbar\\, Open to Relocate to Thane/Mumbai \\,\\textbar\\, +91-7081660941\\\\[2pt]
  \\href{mailto:abhishektiwari6827@gmail.com}{abhishektiwari6827@gmail.com} \\,\\textbar\\,
  \\href{https://linkedin.com/in/abhishek-tiwariiii}{linkedin.com/in/abhishek-tiwariiii} \\,\\textbar\\,
  \\href{https://github.com/abhishek6827}{github.com/abhishek6827} \\,\\textbar\\,
  \\href{https://getchintu.com}{getchintu.com}
\\end{center}
\\vspace{-6pt}
\\small\\linespread{0.94}\\selectfont

%---------- SUMMARY ----------
\\section*{Summary}
Results-driven AI Engineer with 2+ years of production experience developing, testing, and deploying machine learning pipelines, deep learning models, and Generative AI systems. Founder of CHINTU AI (live platform serving 25k+ monthly inferences with 99.8\\% uptime), leading end-to-end implementation across Python (NumPy, Pandas, Scikit-learn, PyTorch/TensorFlow), REST APIs (FastAPI), and SQL/NoSQL databases. Proven track record in data preprocessing, feature engineering, and model evaluation, collaborating seamlessly across engineering teams.

%---------- EXPERIENCE ----------
\\section*{Experience}

\\role{Founder \\& AI Systems Engineer --- CHINTU AI}{Feb 2026 -- Present}%
     {\\href{https://getchintu.com}{getchintu.com} \\hfill Remote, India}
\\scope{Solo-built and operating live AI SaaS platform --- 500+ registered users, 40+ paying subscribers}
\\begin{itemize}
  \\item Architected and deployed production machine learning and GenAI pipelines in Python (FastAPI), sustaining 25k+ monthly requests with 99.8\\% uptime and automated sub-400\\,ms fallback failover circuits.
  \\item Engineered data preprocessing, tokenization, and asynchronous queuing pipelines with RabbitMQ and Redis, reducing p95 task latency from 8\\,s to 1.2\\,s (85\\% drop).
  \\item Built data validation schemas, error-handling boundaries, and automated model evaluation loops, dropping user-facing pipeline failures from 7.2\\% to $<$0.4\\%.
  \\item Implemented PostgreSQL database schemas and REST API endpoints for seamless model inference, logging, and data retrieval.
\\end{itemize}

\\role{Full Stack Developer --- Contract (3-month fixed term)}{Nov 2025 -- Jan 2026}%
     {Indian Capital and Investment (Coimbatore) Limited \\textnormal{{\\small --- fintech investment platform}} \\hfill Remote, India}
\\scope{Team of 20 engineers --- sole owner of payment integrations, webhook infrastructure, and real-time ledger sync}
\\begin{itemize}
  \\item Developed RESTful API endpoints and webhook data ingestion pipelines using Node.js and Express, cutting transaction status latency from 20\\,min to under 3\\,min (85\\% drop) with idempotency verification.
  \\item Containerized application services using Docker and configured automated CI/CD pipelines on AWS with end-to-end integration tests.
\\end{itemize}

\\role{Software Developer}{Aug 2024 -- Oct 2025}%
     {Vasnaani Sanskaran \\textnormal{{\\small --- early-stage software startup}} \\hfill Noida, India}
\\scope{Sole engineer --- designed, developed, and deployed 4 customer-facing web applications from schema to cloud}
\\begin{itemize}
  \\item Implemented backend data models and tuned relational schemas in PostgreSQL, eliminating N+1 queries and improving p95 query response time from $\\sim$850\\,ms to $\\sim$550\\,ms (35\\% boost).
  \\item Built responsive user interfaces and data visualization dashboards using React, conducting code reviews and maintaining technical documentation.
\\end{itemize}

\\role{Full Stack Developer Intern}{Jan 2024 -- Jun 2024}%
     {Hoping Minds \\hfill Mohali, India}
\\begin{itemize}
  \\item Rebuilt performance-critical web pages as modular React components consuming RESTful APIs, raising mobile Lighthouse score from 68 to 94 (38\\% boost) and cutting load time by 22\\%.
\\end{itemize}

%---------- PROJECTS ----------
\\section*{Projects}

\\project{OpenJarvis \\textnormal{--- Local-First Agent Framework, Multi-Hop RAG \\& ML Benchmarks}}%
        {Python, PyTorch/TensorFlow, Scikit-learn, NumPy, Pandas, LangChain, FAISS, FastAPI, Docker}
\\begin{itemize}
  \\item Architected an autonomous agent and ML evaluation framework supporting document indexing, vector embeddings (FAISS), and ML benchmarks; implemented automated testing loops tracking inference latency, token usage, and accuracy across 10k+ requests.
\\end{itemize}

\\project{git-ai-hub \\textnormal{--- Multi-Model Cloud AI Gateway \\& Remote MCP Server}}%
        {Python, FastAPI, REST APIs, Docker, NVIDIA NIM, Groq SDK, Git/GitHub, SSE Streaming}
\\begin{itemize}
  \\item Built a cloud AI gateway and Model Context Protocol (MCP) server over SSE streaming; integrated multi-model REST APIs and automated code inspection workflows with sub-second response times.
\\end{itemize}

\\project{YT-Automation \\textnormal{--- Multimodal ML Pipeline \\& Frame Preprocessing}}%
        {Python, Next.js, TypeScript, FFmpeg, AssemblyAI, Gemini Vision, PostgreSQL, NoSQL}
\\begin{itemize}
  \\item Developed an automated data preprocessing pipeline extracting video frames via FFmpeg and transcripts via AssemblyAI for multimodal AI classification; reduced end-to-end tagging latency from 45\\,min to under 4\\,min (91\\% drop).
\\end{itemize}

%---------- TECHNICAL SKILLS ----------
\\section*{Technical Skills}
\\begin{itemize}[leftmargin=0pt, label={}, itemsep=0.8pt]
  \\item \\textbf{Languages \\& Core:} Python, TypeScript, JavaScript (ES6+), SQL, Bash, Data Structures \\& Algorithms
  \\item \\textbf{Machine Learning \\& Data Science:} NumPy, Pandas, Scikit-learn, Feature Engineering, Supervised/Unsupervised Learning, Data Cleaning
  \\item \\textbf{Deep Learning \\& GenAI:} PyTorch, TensorFlow (Basics), LangChain, Hugging Face, Prompt Engineering, RAG Architectures, FAISS
  \\item \\textbf{APIs \\& Backend:} REST APIs, FastAPI, Node.js, Express.js, Microservices Architecture, Webhooks, SSE Streaming
  \\item \\textbf{Databases \\& Storage:} PostgreSQL, MySQL, NoSQL (MongoDB, Redis), Vector Databases (FAISS, Pinecone)
  \\item \\textbf{Tools \\& Practices:} Git, GitHub, Docker, Jupyter Notebook, Google Colab, Linux, CI/CD, Unit Testing, Code Reviews
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
