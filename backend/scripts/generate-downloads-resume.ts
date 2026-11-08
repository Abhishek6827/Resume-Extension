/**
 * Synchronized Master Resume Generator Script
 * Target: Full-Stack Engineer — Jane Aerospace Private Limited (Bengaluru, India | 1–3 Years)
 * Strictly Enforces Canonical 4 Work Experience Tenures & Dates
 */

export const tailoredResume = {
  "name": "Abhishek Tiwari",
  "title": "Full-Stack Engineer — React, TypeScript, Python (FastAPI/Django), Node.js, PostgreSQL & Docker",
  "contact": {
    "email": "abhishektiwari6827@gmail.com",
    "phone": "+91 70816 60941",
    "linkedin": "linkedin.com/in/abhishek-tiwariiii",
    "github": "github.com/abhishek6827",
    "portfolio": "portfolio.getchintu.com",
    "website": "getchintu.com",
    "location": "Lucknow, India (Relocating to Bengaluru | In-Person Interview Ready | Available from 1 Dec 2026)"
  },
  "summary": "Full-Stack Engineer with 2+ years of production experience building and deploying end-to-end web applications across React, TypeScript, Python (FastAPI/Django), and Node.js with PostgreSQL/MySQL relational schemas. Founder of live SaaS CHINTU AI (getchintu.com, 1,200+ users, 25k+ monthly requests, 99.8% uptime), owning full lifecycle from schema modeling and Razorpay payment webhooks to Docker deployment with zero QA dependency (automated Pytest/Jest suites, CI/CD). Experienced integrating third-party REST APIs and LLM workflows. Accustomed to fast weekly shipping, Friday running software demos, and deep code reviews. Immediate joiner ready for in-person Bengaluru rounds and 1 December 2026 start.",
  "experience": [
    {
      "company": "CHINTU AI",
      "role": "Founder & Lead Full-Stack Engineer",
      "period": "Feb 2026 – Present",
      "location": "Remote, India",
      "technologies": [
        "Python (FastAPI)",
        "React",
        "TypeScript",
        "PostgreSQL",
        "Docker"
      ],
      "achievements": [
        "Architected and shipped live SaaS (getchintu.com) serving 1,200+ users and 25k+ monthly requests with 99.8% uptime, managing full-stack architecture, deployment, and operational stability.",
        "Engineered responsive web interfaces using React and TypeScript with modular components, paired with high-throughput asynchronous Python (FastAPI) and Node.js REST backend microservices.",
        "Designed normalized PostgreSQL relational schemas, query indexing, and connection pooling, sustaining sub-150ms p95 API response times under concurrent production workloads.",
        "Integrated Razorpay payment webhooks with HMAC verification and idempotency keys; owned testing with zero QA (authored automated Pytest/Jest suites, 90%+ coverage) and Dockerized CI/CD."
      ]
    },
    {
      "company": "Indian Capital and Investment (Coimbatore) Limited",
      "role": "Full-Stack & Data Engineer — Contract",
      "period": "Nov 2025 – Jan 2026",
      "location": "Remote, India",
      "technologies": [
        "Python",
        "Node.js",
        "PostgreSQL",
        "REST APIs"
      ],
      "achievements": [
        "Owned payment and transactional data pipelines: replaced legacy polling with webhook-driven event architectures in Node.js and Python, reducing payment-failure detection lag from 20 min to under 3 min.",
        "Integrated enterprise third-party REST APIs with strict payload validation, idempotency keys, and structured logging, maintaining 100% transaction traceability.",
        "Optimized PostgreSQL database queries via execution plan profiling (EXPLAIN ANALYZE) and composite indexing, eliminating N+1 bottlenecks and boosting query speeds by 60%.",
        "Participated in daily Git sprints, conducted peer pull request reviews, and documented architecture runbooks for reliable team handoffs."
      ]
    },
    {
      "company": "Vasnaani Sanskaran",
      "role": "Full-Stack Software Developer",
      "period": "Aug 2024 – Oct 2025",
      "location": "Noida, India",
      "technologies": [
        "React",
        "TypeScript",
        "Python",
        "PostgreSQL",
        "MySQL"
      ],
      "achievements": [
        "Designed, tested, and shipped 4 production customer-facing web applications from schema design to cloud deployment using React, TypeScript, Redux, and Python/Node.js REST APIs.",
        "Implemented relational database schemas (PostgreSQL, MySQL) with ACID compliance, role-based access control (RBAC), and connection pooling across multi-tenant client portals.",
        "Developed modular React UI components with memoized state selectors, improving frontend rendering efficiency by 25% verified through React DevTools Profiler audits.",
        "Maintained testing discipline without QA support, writing automated unit tests and automating build verification pipelines using GitHub Actions."
      ]
    },
    {
      "company": "Hoping Minds",
      "role": "Software Developer Intern",
      "period": "Jan 2024 – Jun 2024",
      "location": "Mohali, India",
      "technologies": [
        "React",
        "Python (Django)",
        "Git",
        "REST APIs"
      ],
      "achievements": [
        "Rebuilt performance-critical learning modules as modular React components consuming Python Django REST APIs, lifting mobile Lighthouse performance scores from 68 to 94 and cutting load times by 22%.",
        "Enforced strict Git branch discipline, submitted atomic pull requests for peer code review, and debugged cross-browser API integrations."
      ]
    }
  ],
  "projects": [
    {
      "name": "RAG Prompt Injection & Defense Audit — AI Security Framework",
      "link": "github.com/abhishek6827",
      "technologies": [
        "Python 3.14",
        "ChromaDB",
        "Pytest (98% Coverage)",
        "OWASP LLM01"
      ],
      "highlights": [
        "Empirical cybersecurity audit and 3-tier defense-in-depth framework (XML Data Spotlighting, Pre-Retrieval Heuristic Scanner, Output Canary Regex Redactor) neutralizing indirect prompt injection attacks (OWASP LLM01); dropped attack success rate from 10/10 to 0/10 with 0 false blocks across 20 corporate inquiries and 1.8ms latency."
      ]
    },
    {
      "name": "LLM-as-a-Judge Bias Audit & Calibration — Alignment Engine",
      "link": "github.com/abhishek6827",
      "technologies": [
        "Python",
        "LLM Evals",
        "Cohen's Kappa",
        "Pytest (93% Coverage)"
      ],
      "highlights": [
        "Empirical evaluation framework auditing position bias (4/30 verdicts flipped by presentation order), verbosity bias (+150 filler words), and self-preference; engineered bidirectional swap consensus calibration raising human agreement from 26/30 to 28/30 (93.3%) with statistical Cohen's Kappa measurement."
      ]
    },
    {
      "name": "Semantic Cache for FAQ Bot — Inference Caching & Latency Optimization",
      "link": "github.com/abhishek6827",
      "technologies": [
        "Python",
        "FastAPI",
        "Sentence-Transformers",
        "Docker"
      ],
      "highlights": [
        "High-throughput vector caching middleware cutting LLM API calls by 67% and reducing latency from 420ms to 1.2ms (350x speedup); engineered automated cosine threshold sweeps (0.75–0.95), lexical negation guards, and automated PII scrubbers with TTL cache hygiene."
      ]
    },
    {
      "name": "AI Resume Tailor & LaTeX Engine — Chrome Extension & Cloud Backend",
      "link": "github.com/abhishek6827",
      "technologies": [
        "React",
        "TypeScript",
        "Next.js",
        "REST APIs",
        "Docker"
      ],
      "highlights": [
        "Built a full-stack Chrome extension and web platform tailoring resumes against job descriptions with multi-provider LLM fallback routing, real-time WebSocket progress updates, and automated server-side PDF compilation."
      ]
    }
  ],
  "technicalSkills": {
    "languagesAndCore": "TypeScript, JavaScript (ES6+), Python, SQL, HTML5, CSS3, Linux/Bash, Clean Code Standards",
    "frontendEngineering": "React.js, Next.js, Redux Toolkit, Tailwind CSS, Modular Component Architecture, Responsive UI",
    "backendAndApis": "Python (FastAPI, Flask, Django), Node.js (Express), RESTful APIs, Webhooks, Microservices, System Architecture",
    "databasesAndStorage": "PostgreSQL, MySQL, Relational Schema Modeling, Query Optimization, Indexing, Redis",
    "devopsTestingAndAi": "Git/GitHub, Docker, Pytest, Jest, CI/CD (GitHub Actions), LLM API Integration (OpenAI/Gemini), Runbooks"
  },
  "education": [
    {
      "institution": "Chitkara University, Chandigarh",
      "degree": "Master of Computer Applications (MCA)",
      "period": "2022 – 2024"
    },
    {
      "institution": "The Bhopal School of Social Sciences (BSSS), Bhopal",
      "degree": "Bachelor of Computer Applications (BCA)",
      "period": "2019 – 2022"
    }
  ]
};
