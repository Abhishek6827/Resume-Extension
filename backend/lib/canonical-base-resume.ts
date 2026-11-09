/**
 * Canonical Base LaTeX Resume for Abhishek Tiwari
 * Standardized 1-page ATS template with 93.9% vertical fill ratio (maxY: 46.47 / 49.50)
 * Verified immutable work experiences, tenures, real metrics, and single-page geometry.
 */

export const CANONICAL_BASE_LATEX_RESUME = `\\documentclass[10pt]{article}

\\usepackage[left=0.38in,right=0.38in,top=0.26in,bottom=0.26in]{geometry}
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
  pdftitle={Abhishek Tiwari - Full Stack and AI Systems Engineer},
  pdfauthor={Abhishek Tiwari}
}
\\pagestyle{empty}
\\hyphenpenalty=10000 \\tolerance=2000 \\emergencystretch=1em
\\setlength{\\parindent}{0pt}

\\titleformat{\\section}
  {\\normalsize\\bfseries\\scshape\\color{darkgray}}
  {}{0em}{}[\\vspace{2pt}\\titlerule]
\\titlespacing{\\section}{0pt}{3.0pt}{4.8pt}

\\setlist[itemize]{leftmargin=11pt, topsep=0.5pt, itemsep=0.2pt,
                  parsep=0pt, label=\\textbullet}

\\newcommand{\\role}[3]{%
  \\textbf{#1} \\hfill \\textit{#2}\\\\[-1pt]
  {\\small #3}\\par\\vspace{0.5pt}%
}
\\newcommand{\\scope}[1]{{\\footnotesize\\textit{#1}}\\par\\vspace{0.5pt}}
\\newcommand{\\project}[2]{%
  \\textbf{#1} \\hfill {\\small\\textit{#2}}\\par\\vspace{0.5pt}%
}

\\begin{document}

%---------- HEADER ----------
{\\centering
  {\\LARGE\\textbf{Abhishek Tiwari}}\\\\[1.5pt]
  \\small
  \\textit{Full Stack Developer --- AI Systems \\& Distributed Payments}\\\\[1.5pt]
  Lucknow, India \\,\\textbar\\, Open to Remote \\& Relocation within India\\\\[1.5pt]
  +91-7081660941 \\,\\textbar\\,
  \\href{mailto:abhishektiwari6827@gmail.com}{abhishektiwari6827@gmail.com} \\,\\textbar\\,
  \\href{https://linkedin.com/in/abhishek-tiwariiii}{linkedin.com/in/abhishek-tiwariiii} \\,\\textbar\\,
  \\href{https://github.com/abhishek6827}{github.com/abhishek6827} \\,\\textbar\\,
  \\href{https://getchintu.com}{getchintu.com} \\,\\textbar\\,
  \\href{https://portfolio.getchintu.com}{portfolio.getchintu.com}\\par
}\\vspace{1pt}
\\small\\linespread{0.88}\\selectfont

%---------- SUMMARY ----------
\\section*{Summary}
Full-stack and AI systems engineer with 2+ years of production experience in \\textbf{high-availability SaaS}, \\textbf{AI/LLM reliability \\& security} (OWASP LLM01 injection defense, LLM-as-a-judge bias calibration, semantic caching), and \\textbf{distributed payment infrastructure} (Razorpay/Stripe/Zoho gateways, HMAC-verified idempotent webhooks). Founder of CHINTU AI, operating a live SaaS (Web, Desktop, Android) serving 500+ users and 25k+ monthly LLM inferences with 99.8\\% uptime; built low-latency Java RESP protocol socket servers and B+Tree storage engines.

%---------- EXPERIENCE ----------
\\section*{Experience}

\\role{Founder \\& Full Stack Developer --- CHINTU AI}{Feb 2026 -- Present}%
     {\\href{https://getchintu.com}{getchintu.com} \\hfill Remote, India}
\\scope{Solo-built and operating a live SaaS platform --- 500+ registered users, 40+ paying subscribers}
\\begin{itemize}
  \\item Built multi-platform clients (React, Electron for Windows/macOS, Android) and backend services serving 25k+ monthly LLM inferences; engineered runtime routing across Groq, Gemini, and OpenRouter with sub-400\\,ms fallback, achieving 99.8\\% uptime.
  \\item Developed asynchronous Python/FastAPI services with RabbitMQ background workers for 63-language audio transcription and usage tracking, maintaining sub-2\\,s task queue latency under peak production loads.
  \\item Implemented Razorpay credit-based billing with webhook-driven entitlement sync, HMAC signature verification, and idempotent transaction processing with 100\\% reconciliation accuracy.
  \\item Audited response logs to eliminate silent LLM failures (empty streams, unhandled provider timeouts); added structured JSON schema validation and exponential retries, slashing user-facing error rates from 7.2\\% to $<$0.4\\%.
\\end{itemize}

\\role{Full Stack Developer --- Contract (3-month fixed term)}{Nov 2025 -- Jan 2026}%
     {Indian Capital and Investment (Coimbatore) Limited \\textnormal{{\\small --- fintech investment platform}} \\hfill Remote, India}
\\scope{Team of 20 engineers --- sole owner of the Stripe/Zoho Payments integration, end to end}
\\begin{itemize}
  \\item Replaced scheduled polling with a webhook-driven event pipeline, cutting payment-failure detection lag from 20\\,min to under 3\\,min; implemented idempotency-key handling and HMAC signature verification across all endpoints.
  \\item Migrated CI/CD deployments to Firebase App Hosting, cutting release cycle times from 30\\,min to under 5\\,min.
\\end{itemize}

\\role{Software Developer}{Aug 2024 -- Oct 2025}%
     {Vasnaani Sanskaran \\textnormal{{\\small --- early-stage software startup}} \\hfill Noida, India}
\\scope{Sole engineer --- designed and shipped 4 customer-facing web applications from schema to deployment}
\\begin{itemize}
  \\item Eliminated N+1 query patterns and added composite indexes on 3 high-traffic endpoints; p95 response time dropped from $\\sim$850\\,ms to $\\sim$550\\,ms, confirmed in production server-timing logs.
  \\item Introduced memoized selectors (\\texttt{reselect}) across 12 Redux-connected components, eliminating full-tree re-renders; measured 25\\% improvement with React DevTools Profiler.
\\end{itemize}

\\role{Full Stack Developer Intern}{Jan 2024 -- Jun 2024}%
     {Hoping Minds \\hfill Mohali, India}
\\begin{itemize}
  \\item Rebuilt performance-critical pages as React components consuming Django REST APIs, raising the Lighthouse mobile score from 68 to 94 and cutting page load time by 22\\%.
\\end{itemize}

%---------- PROJECTS ----------
\\section*{Projects}

\\project{RAG Prompt Injection \\& Defense Audit \\textnormal{--- AI Security Framework}}%
        {Python 3.14, ChromaDB, Pytest (98\\% Coverage), OWASP LLM01, Regex Guardrails}
\\begin{itemize}
  \\item Empirical cybersecurity audit and 3-tier defense-in-depth framework (XML Data Spotlighting, Pre-Retrieval Heuristic Scanner, Output Canary Regex Redactor) neutralizing indirect prompt injection attacks (OWASP LLM01); dropped attack success rate from 10/10 to 0/10 with 0 false blocks across 20 corporate inquiries and 1.8\\,ms average latency overhead.
\\end{itemize}

\\project{LLM-as-a-Judge Bias Audit \\& Calibration \\textnormal{--- Alignment Engine}}%
        {Python, LLM Evals, Cohen's Kappa, Bias Mitigation, Pytest (93\\% Coverage), JSON}
\\begin{itemize}
  \\item Empirical evaluation framework auditing position bias (4/30 verdicts flipped by presentation order), verbosity bias (+150 filler words), and self-preference; engineered bidirectional swap consensus calibration that raised human agreement from 26/30 to 28/30 (93.3\\%) with statistical Cohen's Kappa measurement.
\\end{itemize}

\\project{Semantic Cache for FAQ Bot\\textnormal{--- Inference Caching \\& Latency Optimization}}%
        {Python, FastAPI, Sentence-Transformers, Vector Similarity, Pytest, Docker}
\\begin{itemize}
  \\item High-throughput vector caching middleware cutting LLM API calls by 67\\% and reducing latency from 420\\,ms to 1.2\\,ms (350x speedup); engineered automated cosine threshold sweeps (0.75--0.95), Hindi/English lexical negation guards, and automated PII scrubbers with TTL cache hygiene.
\\end{itemize}

\\project{AI Resume Tailor \\& LaTeX Engine \\textnormal{--- Chrome Extension \\& Cloud Backend}}%
        {React, TypeScript, Java Spring Boot, AWS Elastic Beanstalk, Groq, LaTeX}
\\begin{itemize}
  \\item Built a Chrome extension (React, Tailwind) with a multi-LLM fallback routing backend on Java Spring Boot (AWS Elastic Beanstalk); parses PDF/DOCX documents and dynamically compiles tailored resumes into ATS-compliant LaTeX PDFs.
\\end{itemize}

%---------- TECHNICAL SKILLS ----------
\\section*{Technical Skills}
\\begin{itemize}[leftmargin=0pt, label={}, itemsep=1pt]
  \\item \\textbf{Languages:} TypeScript, JavaScript (ES6+), Python, Java (21/23), SQL
  \\item \\textbf{AI Systems \\& LLM Evals:} Multi-LLM Routing (Groq, Gemini, OpenRouter), OWASP LLM01 Defense, LLM-as-a-Judge Calibration, Cohen's Kappa, Semantic Caching (MiniLM-L12-v2), Prompt Engineering \\& JSON Schema
  \\item \\textbf{Backend \\& Systems:} Node.js, Express.js, FastAPI, Spring Boot, Django, Raw TCP Sockets, RabbitMQ Queues, REST APIs
  \\item \\textbf{Payments \\& Billing:} Razorpay, Stripe, Zoho Payments, Webhook Pipelines, HMAC Verification, Idempotency Keys
  \\item \\textbf{Databases \\& Vector Stores:} PostgreSQL, Supabase, MongoDB, Qdrant, ChromaDB, Redis (RESP Protocol), In-Memory Buffers
  \\item \\textbf{Frontend \\& Cloud/DevOps:} React.js, Next.js 15, Electron, Android, Tailwind CSS, Docker, AWS Elastic Beanstalk, Firebase, Git, Pytest
\\end{itemize}

%---------- EDUCATION ----------
\\section*{Education}
\\textbf{Chitkara University}, Chandigarh --- Master of Computer Applications (MCA) \\hfill 2022 -- 2024\\\\[1pt]
\\textbf{The Bhopal School of Social Sciences (BSSS)}, Bhopal --- Bachelor of Computer Applications (BCA) \\hfill 2019 -- 2022

\\end{document}`;

export const CANONICAL_BASE_LATEX_LENGTH = CANONICAL_BASE_LATEX_RESUME.length;
