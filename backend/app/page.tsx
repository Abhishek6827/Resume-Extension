"use client";

import React, { useState, useEffect, useRef } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

const AI_MODELS = [
  { id: "nvidia:nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 550B (Quality)", icon: "https://www.google.com/s2/favicons?domain=nvidia.com&sz=128" },
  { id: "openrouter:openrouter/free", name: "Auto Free Model (OpenRouter)", icon: "https://www.google.com/s2/favicons?domain=openrouter.ai&sz=128" },
  { id: "nvidia:z-ai/glm-5.2", name: "GLM-5.2 (Balanced)", icon: "https://www.google.com/s2/favicons?domain=zhipuai.cn&sz=128" },
  { id: "cerebras:gpt-oss-120b", name: "Cerebras GPT-OSS 120B (Fast)", icon: "https://www.google.com/s2/favicons?domain=cerebras.net&sz=128" },
  { id: "groq:llama-3.3-70b-versatile", name: "Groq Llama-70B (Fast)", icon: "https://www.google.com/s2/favicons?domain=groq.com&sz=128" }
];

function extractCandidateNameFromLatex(latex: string): string {
  const nameMatch = latex.match(/\\name\s*\{([^}]+)\}/i);
  if (nameMatch && nameMatch[1]) {
    return nameMatch[1].trim().replace(/[^a-zA-Z0-9]/g, "_");
  }

  const headerMatch = latex.match(/\\header\s*\{([^}]+)\}/i);
  if (headerMatch && headerMatch[1]) {
    return headerMatch[1].trim().replace(/[^a-zA-Z0-9]/g, "_");
  }

  const hugeMatch = latex.match(/\\(Huge|huge)\s*\{([^}]+)\}/i);
  if (hugeMatch && hugeMatch[2]) {
    return hugeMatch[2].trim().replace(/[^a-zA-Z0-9]/g, "_");
  }

  return "Tailored";
}

const CustomDropdown = ({ value, onChange, options, label, focusColor }: { value: string, onChange: (val: string) => void, options: any[], label: string, focusColor: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedModel = options.find((m: any) => m.id === value);

  return (
    <div>
      <span className="text-xs text-slate-400 mb-1 block">{label}</span>
      <div className="relative">
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${isOpen ? focusColor : 'hover:bg-white/10'}`}
        >
          <img src={selectedModel?.icon} alt="icon" className="w-5 h-5 rounded" onError={(e) => e.currentTarget.src='data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><circle cx="12" cy="12" r="10"></circle></svg>'} />
          <span className="text-sm text-slate-200 flex-1">{selectedModel?.name}</span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
        
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#121324] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden backdrop-blur-xl">
              {options.map((m: any) => (
                <div 
                  key={m.id}
                  onClick={() => { onChange(m.id); setIsOpen(false); }}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-white/10 ${value === m.id ? 'bg-indigo-500/10' : ''}`}
                >
                  <img src={m.icon} alt="icon" className="w-5 h-5 rounded" onError={(e) => e.currentTarget.src='data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><circle cx="12" cy="12" r="10"></circle></svg>'} />
                  <span className={`text-sm ${value === m.id ? 'text-indigo-300 font-medium' : 'text-slate-300'}`}>{m.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const PipelineVisualizer = ({ status }: { status: string }) => {
  const [ticks, setTicks] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const compileRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const experienceRef = useRef<HTMLDivElement>(null);
  const projectsRef = useRef<HTMLDivElement>(null);
  const skillsRef = useRef<HTMLDivElement>(null);
  const matchScoreRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<{
    source: { x: number; y: number };
    compile: { x: number; y: number };
    summaryLeft: { x: number; y: number };
    summaryRight: { x: number; y: number };
    experienceLeft: { x: number; y: number };
    experienceRight: { x: number; y: number };
    projectsLeft: { x: number; y: number };
    projectsRight: { x: number; y: number };
    skillsLeft: { x: number; y: number };
    skillsRight: { x: number; y: number };
    matchScoreLeft: { x: number; y: number };
    matchScoreRight: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    if (status !== "tailoring") {
      setTicks(0);
      return;
    }
    const timer = setInterval(() => {
      setTicks((prev) => prev + 1);
    }, 2800); // Realistic tick progression tracking
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    const updateCoords = () => {
      if (
        !containerRef.current ||
        !sourceRef.current ||
        !compileRef.current ||
        !summaryRef.current ||
        !experienceRef.current ||
        !projectsRef.current ||
        !skillsRef.current ||
        !matchScoreRef.current
      ) return;

      const containerRect = containerRef.current.getBoundingClientRect();

      const getPoints = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        return {
          left: {
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top + rect.height / 2
          },
          right: {
            x: rect.right - containerRect.left,
            y: rect.top - containerRect.top + rect.height / 2
          }
        };
      };

      setCoords({
        source: getPoints(sourceRef.current).right,
        compile: getPoints(compileRef.current).left,
        summaryLeft: getPoints(summaryRef.current).left,
        summaryRight: getPoints(summaryRef.current).right,
        experienceLeft: getPoints(experienceRef.current).left,
        experienceRight: getPoints(experienceRef.current).right,
        projectsLeft: getPoints(projectsRef.current).left,
        projectsRight: getPoints(projectsRef.current).right,
        skillsLeft: getPoints(skillsRef.current).left,
        skillsRight: getPoints(skillsRef.current).right,
        matchScoreLeft: getPoints(matchScoreRef.current).left,
        matchScoreRight: getPoints(matchScoreRef.current).right
      });
    };

    updateCoords();

    const t1 = setTimeout(updateCoords, 100);
    const t2 = setTimeout(updateCoords, 400);

    const observer = new ResizeObserver(updateCoords);
    if (containerRef.current) observer.observe(containerRef.current);
    if (sourceRef.current) observer.observe(sourceRef.current);
    if (compileRef.current) observer.observe(compileRef.current);
    if (summaryRef.current) observer.observe(summaryRef.current);
    if (experienceRef.current) observer.observe(experienceRef.current);
    if (projectsRef.current) observer.observe(projectsRef.current);
    if (skillsRef.current) observer.observe(skillsRef.current);
    if (matchScoreRef.current) observer.observe(matchScoreRef.current);

    window.addEventListener("resize", updateCoords);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      observer.disconnect();
      window.removeEventListener("resize", updateCoords);
    };
  }, [status, ticks]);

  const isFinished = ["compiling", "success"].includes(status);

  const getBranchState = (branch: "summary" | "experience" | "projects" | "skills" | "matchScore") => {
    if (isFinished) return { active: false, done: true, ready: false, log: "Completed.", progress: 100 };
    if (status === "parsing") return { active: false, done: false, ready: false, log: "Pending...", progress: 0 };
    if (status === "compiling") return { active: false, done: true, ready: false, log: "Completed.", progress: 100 };

    // Each branch: progress = clamp((ticks - startTick) / (endTick - startTick) * 100, 0, 100)
    switch (branch) {
      case "summary": { // starts 0, done at 3
        const p = Math.min(100, Math.round((ticks / 3) * 100));
        if (ticks < 1) return { active: true, done: false, ready: false, log: "Analyzing profile summary...", progress: p };
        if (ticks < 3) return { active: true, done: false, ready: false, log: "Optimizing summary keywords...", progress: p };
        return { active: false, done: false, ready: true, log: "Ready to merge.", progress: 100 };
      }
      case "experience": { // starts 2, done at 6
        const p = ticks < 2 ? 0 : Math.min(100, Math.round(((ticks - 2) / 4) * 100));
        if (ticks < 2) return { active: false, done: false, ready: false, log: "Queued...", progress: 0 };
        if (ticks < 4) return { active: true, done: false, ready: false, log: "Aligning job metrics...", progress: p };
        if (ticks < 6) return { active: true, done: false, ready: false, log: "Normalizing highlights...", progress: p };
        return { active: false, done: false, ready: true, log: "Ready to merge.", progress: 100 };
      }
      case "projects": { // starts 3, done at 7
        const p = ticks < 3 ? 0 : Math.min(100, Math.round(((ticks - 3) / 4) * 100));
        if (ticks < 3) return { active: false, done: false, ready: false, log: "Queued...", progress: 0 };
        if (ticks < 5) return { active: true, done: false, ready: false, log: "Matching projects to JD...", progress: p };
        if (ticks < 7) return { active: true, done: false, ready: false, log: "Refining tech bullet points...", progress: p };
        return { active: false, done: false, ready: true, log: "Ready to merge.", progress: 100 };
      }
      case "skills": { // starts 4, done at 8
        const p = ticks < 4 ? 0 : Math.min(100, Math.round(((ticks - 4) / 4) * 100));
        if (ticks < 4) return { active: false, done: false, ready: false, log: "Queued...", progress: 0 };
        if (ticks < 6) return { active: true, done: false, ready: false, log: "Sorting skill categories...", progress: p };
        if (ticks < 8) return { active: true, done: false, ready: false, log: "Normalizing dynamic fields...", progress: p };
        return { active: false, done: false, ready: true, log: "Ready to merge.", progress: 100 };
      }
      case "matchScore": { // starts 8, runs indefinitely until API finishes
        const p = ticks < 8 ? 0 : Math.min(90, Math.round(((ticks - 8) / 6) * 90));
        if (ticks < 8) return { active: false, done: false, ready: false, log: "Queued...", progress: 0 };
        if (ticks < 10) return { active: true, done: false, ready: false, log: "Aggregating tailored segments...", progress: p };
        return { active: true, done: false, ready: false, log: "Calculating ATS score & keywords...", progress: Math.min(90, p) };
      }
    }
  };

  const summary = getBranchState("summary");
  const experience = getBranchState("experience");
  const projects = getBranchState("projects");
  const skills = getBranchState("skills");
  const matchScore = getBranchState("matchScore");

  const getPathD = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const dx = Math.abs(end.x - start.x) * 0.5;
    return `M ${start.x},${start.y} C ${start.x + dx},${start.y} ${end.x - dx},${end.y} ${end.x},${end.y}`;
  };

  return (
    <div ref={containerRef} className="w-full mt-4 flex flex-col gap-6 p-6 bg-slate-900/60 border border-white/10 rounded-2xl relative overflow-hidden backdrop-blur-xl">
      <style>{`
        .active-glow-summary { border-color: rgba(129, 140, 248, 0.5) !important; box-shadow: 0 0 15px rgba(129, 140, 248, 0.15); }
        .active-glow-experience { border-color: rgba(167, 139, 250, 0.5) !important; box-shadow: 0 0 15px rgba(167, 139, 250, 0.15); }
        .active-glow-projects { border-color: rgba(244, 114, 182, 0.5) !important; box-shadow: 0 0 15px rgba(244, 114, 182, 0.15); }
        .active-glow-skills { border-color: rgba(45, 212, 191, 0.5) !important; box-shadow: 0 0 15px rgba(45, 212, 191, 0.15); }
        .active-glow-matchScore { border-color: rgba(168, 85, 247, 0.5) !important; box-shadow: 0 0 15px rgba(168, 85, 247, 0.15); }
      `}</style>

      {/* SVG Circuit Lines - Desktop Only */}
      {coords && (
        <div className="hidden md:block absolute inset-0 w-full h-full pointer-events-none z-0">
          <svg className="w-full h-full">
            <defs>
              {/* Glow Filter for Sparkle Dots */}
              <filter id="sparkle-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 1. Summary Traces and Sparkles */}
            <path d={getPathD(coords.source, coords.summaryLeft)} fill="none" stroke={summary.ready || summary.done ? "rgba(129, 140, 248, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            <path d={getPathD(coords.summaryRight, coords.compile)} fill="none" stroke={summary.ready || summary.done ? "rgba(129, 140, 248, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            {(status === "tailoring" || isFinished) && (
              <circle r="4.5" fill="#818cf8" filter="url(#sparkle-glow)">
                <animateMotion
                  key={`sum-left-${summary.active ? "fast" : "slow"}`}
                  dur={summary.active ? "1.4s" : "2.8s"}
                  repeatCount="indefinite"
                  path={getPathD(coords.source, coords.summaryLeft)}
                />
              </circle>
            )}
            {((status === "tailoring" && summary.ready) || isFinished) && (
              <circle r="4.5" fill="#818cf8" filter="url(#sparkle-glow)">
                <animateMotion
                  key={`sum-right-${isFinished ? "fast" : "slow"}`}
                  dur={isFinished ? "1.4s" : "2.8s"}
                  repeatCount="indefinite"
                  path={getPathD(coords.summaryRight, coords.compile)}
                />
              </circle>
            )}

            {/* 2. Experience Traces and Sparkles */}
            <path d={getPathD(coords.source, coords.experienceLeft)} fill="none" stroke={experience.ready || experience.done ? "rgba(167, 139, 250, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            <path d={getPathD(coords.experienceRight, coords.compile)} fill="none" stroke={experience.ready || experience.done ? "rgba(167, 139, 250, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            {((status === "tailoring" && ticks >= 2) || isFinished) && (
              <circle r="4.5" fill="#c084fc" filter="url(#sparkle-glow)">
                <animateMotion
                  key={`exp-left-${experience.active ? "fast" : "slow"}`}
                  dur={experience.active ? "1.4s" : "2.8s"}
                  repeatCount="indefinite"
                  path={getPathD(coords.source, coords.experienceLeft)}
                />
              </circle>
            )}
            {((status === "tailoring" && experience.ready) || isFinished) && (
              <circle r="4.5" fill="#c084fc" filter="url(#sparkle-glow)">
                <animateMotion
                  key={`exp-right-${isFinished ? "fast" : "slow"}`}
                  dur={isFinished ? "1.4s" : "2.8s"}
                  repeatCount="indefinite"
                  path={getPathD(coords.experienceRight, coords.compile)}
                />
              </circle>
            )}

            {/* 3. Projects Traces and Sparkles */}
            <path d={getPathD(coords.source, coords.projectsLeft)} fill="none" stroke={projects.ready || projects.done ? "rgba(244, 114, 182, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            <path d={getPathD(coords.projectsRight, coords.compile)} fill="none" stroke={projects.ready || projects.done ? "rgba(244, 114, 182, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            {((status === "tailoring" && ticks >= 3) || isFinished) && (
              <circle r="4.5" fill="#f472b6" filter="url(#sparkle-glow)">
                <animateMotion
                  key={`proj-left-${projects.active ? "fast" : "slow"}`}
                  dur={projects.active ? "1.4s" : "2.8s"}
                  repeatCount="indefinite"
                  path={getPathD(coords.source, coords.projectsLeft)}
                />
              </circle>
            )}
            {((status === "tailoring" && projects.ready) || isFinished) && (
              <circle r="4.5" fill="#f472b6" filter="url(#sparkle-glow)">
                <animateMotion
                  key={`proj-right-${isFinished ? "fast" : "slow"}`}
                  dur={isFinished ? "1.4s" : "2.8s"}
                  repeatCount="indefinite"
                  path={getPathD(coords.projectsRight, coords.compile)}
                />
              </circle>
            )}

            {/* 4. Skills Traces and Sparkles */}
            <path d={getPathD(coords.source, coords.skillsLeft)} fill="none" stroke={skills.ready || skills.done ? "rgba(45, 212, 191, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            <path d={getPathD(coords.skillsRight, coords.compile)} fill="none" stroke={skills.ready || skills.done ? "rgba(45, 212, 191, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            {((status === "tailoring" && ticks >= 4) || isFinished) && (
              <circle r="4.5" fill="#2dd4bf" filter="url(#sparkle-glow)">
                <animateMotion
                  key={`sk-left-${skills.active ? "fast" : "slow"}`}
                  dur={skills.active ? "1.4s" : "2.8s"}
                  repeatCount="indefinite"
                  path={getPathD(coords.source, coords.skillsLeft)}
                />
              </circle>
            )}
            {((status === "tailoring" && skills.ready) || isFinished) && (
              <circle r="4.5" fill="#2dd4bf" filter="url(#sparkle-glow)">
                <animateMotion
                  key={`sk-right-${isFinished ? "fast" : "slow"}`}
                  dur={isFinished ? "1.4s" : "2.8s"}
                  repeatCount="indefinite"
                  path={getPathD(coords.skillsRight, coords.compile)}
                />
              </circle>
            )}

            {/* 5. Match & Score Traces and Sparkles */}
            <path d={getPathD(coords.source, coords.matchScoreLeft)} fill="none" stroke={matchScore.done ? "rgba(168, 85, 247, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            <path d={getPathD(coords.matchScoreRight, coords.compile)} fill="none" stroke={matchScore.done ? "rgba(168, 85, 247, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            {((status === "tailoring" && ticks >= 8) || isFinished) && (
              <circle r="4.5" fill="#a855f7" filter="url(#sparkle-glow)">
                <animateMotion
                  key={`ms-left-${matchScore.active ? "fast" : "slow"}`}
                  dur={matchScore.active ? "1.4s" : "2.8s"}
                  repeatCount="indefinite"
                  path={getPathD(coords.source, coords.matchScoreLeft)}
                />
              </circle>
            )}
            {isFinished && (
              <circle r="4.5" fill="#a855f7" filter="url(#sparkle-glow)">
                <animateMotion
                  key="ms-right-fast"
                  dur="1.4s"
                  repeatCount="indefinite"
                  path={getPathD(coords.matchScoreRight, coords.compile)}
                />
              </circle>
            )}
          </svg>
        </div>
      )}

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 min-h-[500px] md:px-8 w-full">
        
        {/* 1. Source Node */}
        <div className="w-full md:w-[15%] flex flex-col items-center justify-center">
          <div ref={sourceRef} className={`p-5 rounded-2xl bg-slate-950/80 border border-white/10 flex flex-col items-center gap-2 text-center w-full max-w-[160px] transition-all duration-500 ${status === "parsing" ? "border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]" : "border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.05)]"}`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${status === "parsing" ? "bg-indigo-500/20 text-indigo-400 animate-pulse" : "bg-emerald-500/20 text-emerald-400"}`}>
              {status === "parsing" ? (
                <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              )}
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Data Source</span>
            <span className="text-[10px] text-slate-500 leading-tight">Resume & JD Loaded</span>
          </div>
        </div>

        {/* 2. Middle Parallel Branches */}
        <div className="w-full md:w-[45%] flex flex-col gap-3 px-2">
          
          {/* Branch A: Summary */}
          <div ref={summaryRef} className={`rounded-xl bg-slate-950/70 border overflow-hidden transition-all duration-300 ${summary.done ? "border-emerald-500/20" : summary.ready ? "border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.05)]" : summary.active ? "active-glow-summary" : "border-white/5"}`}>
            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${summary.done ? "bg-emerald-500/25 text-emerald-400" : summary.ready ? "bg-indigo-500/25 text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.2)]" : summary.active ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-slate-600"}`}>
                  {summary.done || summary.ready ? "✓" : "A"}
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${summary.done ? "text-slate-200" : summary.ready ? "text-indigo-300" : summary.active ? "text-indigo-300" : "text-slate-200"}`}>Summary Tailoring</span>
                  <span className={`text-[10px] ${summary.ready ? "text-indigo-400/80" : "text-slate-500"}`}>{summary.log}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mr-2">
                {summary.progress > 0 && <span className="text-[9px] font-mono text-slate-500">{summary.progress}%</span>}
                {summary.active && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping"></span>}
                {summary.ready && !summary.done && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_4px_#818cf8]"></span>}
              </div>
            </div>
            <div className="h-[2px] w-full bg-white/5">
              <div className={`h-full transition-all duration-700 ease-out ${summary.done ? "bg-emerald-500" : summary.ready ? "bg-indigo-400" : "bg-gradient-to-r from-indigo-500 to-purple-500"}`} style={{ width: `${summary.progress}%` }} />
            </div>
          </div>

          {/* Branch B: Experience */}
          <div ref={experienceRef} className={`rounded-xl bg-slate-950/70 border overflow-hidden transition-all duration-300 ${experience.done ? "border-emerald-500/20" : experience.ready ? "border-purple-500/30 shadow-[0_0_10px_rgba(167,139,250,0.05)]" : experience.active ? "active-glow-experience" : "border-white/5"}`}>
            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${experience.done ? "bg-emerald-500/25 text-emerald-400" : experience.ready ? "bg-purple-500/25 text-purple-400 shadow-[0_0_8px_rgba(167,139,250,0.2)]" : experience.active ? "bg-purple-500/20 text-purple-400" : "bg-white/5 text-slate-600"}`}>
                  {experience.done || experience.ready ? "✓" : "B"}
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${experience.done ? "text-slate-200" : experience.ready ? "text-purple-300" : experience.active ? "text-purple-300" : "text-slate-200"}`}>Experience Alignment</span>
                  <span className={`text-[10px] ${experience.ready ? "text-purple-400/80" : "text-slate-500"}`}>{experience.log}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mr-2">
                {experience.progress > 0 && <span className="text-[9px] font-mono text-slate-500">{experience.progress}%</span>}
                {experience.active && <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping"></span>}
                {experience.ready && !experience.done && <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_4px_#a78bfa]"></span>}
              </div>
            </div>
            <div className="h-[2px] w-full bg-white/5">
              <div className={`h-full transition-all duration-700 ease-out ${experience.done ? "bg-emerald-500" : experience.ready ? "bg-purple-400" : "bg-gradient-to-r from-purple-500 to-pink-500"}`} style={{ width: `${experience.progress}%` }} />
            </div>
          </div>

          {/* Branch C: Projects */}
          <div ref={projectsRef} className={`rounded-xl bg-slate-950/70 border overflow-hidden transition-all duration-300 ${projects.done ? "border-emerald-500/20" : projects.ready ? "border-pink-500/30 shadow-[0_0_10px_rgba(244,114,182,0.05)]" : projects.active ? "active-glow-projects" : "border-white/5"}`}>
            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${projects.done ? "bg-emerald-500/25 text-emerald-400" : projects.ready ? "bg-pink-500/25 text-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.2)]" : projects.active ? "bg-pink-500/20 text-pink-400" : "bg-white/5 text-slate-600"}`}>
                  {projects.done || projects.ready ? "✓" : "C"}
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${projects.done ? "text-slate-200" : projects.ready ? "text-pink-300" : projects.active ? "text-pink-300" : "text-slate-200"}`}>Project Optimization</span>
                  <span className={`text-[10px] ${projects.ready ? "text-pink-400/80" : "text-slate-500"}`}>{projects.log}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mr-2">
                {projects.progress > 0 && <span className="text-[9px] font-mono text-slate-500">{projects.progress}%</span>}
                {projects.active && <span className="h-1.5 w-1.5 rounded-full bg-pink-400 animate-ping"></span>}
                {projects.ready && !projects.done && <span className="h-1.5 w-1.5 rounded-full bg-pink-400 shadow-[0_0_4px_#f472b6]"></span>}
              </div>
            </div>
            <div className="h-[2px] w-full bg-white/5">
              <div className={`h-full transition-all duration-700 ease-out ${projects.done ? "bg-emerald-500" : projects.ready ? "bg-pink-400" : "bg-gradient-to-r from-pink-500 to-rose-500"}`} style={{ width: `${projects.progress}%` }} />
            </div>
          </div>

          {/* Branch D: Skills */}
          <div ref={skillsRef} className={`rounded-xl bg-slate-950/70 border overflow-hidden transition-all duration-300 ${skills.done ? "border-emerald-500/20" : skills.ready ? "border-teal-500/30 shadow-[0_0_10px_rgba(45,212,191,0.05)]" : skills.active ? "active-glow-skills" : "border-white/5"}`}>
            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${skills.done ? "bg-emerald-500/25 text-emerald-400" : skills.ready ? "bg-teal-500/25 text-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.2)]" : skills.active ? "bg-teal-500/20 text-teal-400" : "bg-white/5 text-slate-600"}`}>
                  {skills.done || skills.ready ? "✓" : "D"}
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${skills.done ? "text-slate-200" : skills.ready ? "text-teal-300" : skills.active ? "text-teal-300" : "text-slate-200"}`}>Skills Prioritization</span>
                  <span className={`text-[10px] ${skills.ready ? "text-teal-400/80" : "text-slate-500"}`}>{skills.log}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mr-2">
                {skills.progress > 0 && <span className="text-[9px] font-mono text-slate-500">{skills.progress}%</span>}
                {skills.active && <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-ping"></span>}
                {skills.ready && !skills.done && <span className="h-1.5 w-1.5 rounded-full bg-teal-400 shadow-[0_0_4px_#2dd4bf]"></span>}
              </div>
            </div>
            <div className="h-[2px] w-full bg-white/5">
              <div className={`h-full transition-all duration-700 ease-out ${skills.done ? "bg-emerald-500" : skills.ready ? "bg-teal-400" : "bg-gradient-to-r from-teal-500 to-cyan-500"}`} style={{ width: `${skills.progress}%` }} />
            </div>
          </div>

          {/* Branch E: Match & Score */}
          <div ref={matchScoreRef} className={`rounded-xl bg-slate-950/70 border overflow-hidden transition-all duration-300 ${matchScore.done ? "border-emerald-500/20" : matchScore.active ? "active-glow-matchScore" : "border-white/5"}`}>
            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${matchScore.done ? "bg-emerald-500/25 text-emerald-400" : matchScore.active ? "bg-purple-500/25 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.2)]" : "bg-white/5 text-slate-600"}`}>
                  {matchScore.done ? "✓" : "E"}
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${matchScore.done ? "text-slate-200" : matchScore.active ? "text-purple-300" : "text-slate-200"}`}>Match & Score Analysis</span>
                  <span className={`text-[10px] ${matchScore.active ? "text-purple-400/80" : "text-slate-500"}`}>{matchScore.log}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mr-2">
                {matchScore.progress > 0 && <span className="text-[9px] font-mono text-slate-500">{matchScore.progress}%</span>}
                {matchScore.active && !matchScore.done && <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping"></span>}
              </div>
            </div>
            <div className="h-[2px] w-full bg-white/5">
              <div className={`h-full transition-all duration-700 ease-out ${matchScore.done ? "bg-emerald-500" : "bg-gradient-to-r from-purple-500 to-pink-500"}`} style={{ width: `${matchScore.progress}%` }} />
            </div>
          </div>

        </div>

        {/* 3. Output Node */}
        <div className="w-full md:w-[15%] flex flex-col items-center justify-center">
          <div ref={compileRef} className={`p-5 rounded-2xl bg-slate-950/80 border border-white/10 flex flex-col items-center gap-2 text-center w-full max-w-[160px] transition-all duration-500 ${status === "compiling" ? "border-pink-500/50 shadow-[0_0_20px_rgba(244,114,182,0.2)]" : status === "success" ? "border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]" : "opacity-40"}`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${status === "compiling" ? "bg-pink-500/20 text-pink-400" : status === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-500"}`}>
              {status === "compiling" ? (
                <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H20" /></svg>
              )}
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">PDF Compile</span>
            <span className="text-[10px] text-slate-500 leading-tight">
              {status === "compiling" ? "Compiling LaTeX..." : status === "success" ? "Ready to Download" : "Awaiting Merges"}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

const ParallelPipelineVisualizer = ({ 
  status, 
  progress: realProgress, 
  activePhases: realPhases 
}: { 
  status: string; 
  progress: { [key: string]: number }; 
  activePhases: { [key: string]: string }; 
}) => {
  const [selectedTab, setSelectedTab] = useState<string>("nvidia:nvidia/nemotron-3-ultra-550b-a55b");

  const [visualProgress, setVisualProgress] = useState<{ [key: string]: number }>({
    "cerebras:gpt-oss-120b": 0,
    "groq:llama-3.3-70b-versatile": 0,
    "openrouter:openrouter/free": 0,
    "nvidia:z-ai/glm-5.2": 0,
    "nvidia:nvidia/nemotron-3-ultra-550b-a55b": 0,
  });

  const [visualPhases, setVisualPhases] = useState<{ [key: string]: string }>({
    "cerebras:gpt-oss-120b": "Queued",
    "groq:llama-3.3-70b-versatile": "Queued",
    "openrouter:openrouter/free": "Queued",
    "nvidia:z-ai/glm-5.2": "Queued",
    "nvidia:nvidia/nemotron-3-ultra-550b-a55b": "Queued",
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const compileRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const experienceRef = useRef<HTMLDivElement>(null);
  const projectsRef = useRef<HTMLDivElement>(null);
  const skillsRef = useRef<HTMLDivElement>(null);
  const matchScoreRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<{
    source: { x: number; y: number };
    compile: { x: number; y: number };
    summaryLeft: { x: number; y: number };
    summaryRight: { x: number; y: number };
    experienceLeft: { x: number; y: number };
    experienceRight: { x: number; y: number };
    projectsLeft: { x: number; y: number };
    projectsRight: { x: number; y: number };
    skillsLeft: { x: number; y: number };
    skillsRight: { x: number; y: number };
    matchScoreLeft: { x: number; y: number };
    matchScoreRight: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    if (!["parsing", "tailoring", "compiling"].includes(status)) {
      return;
    }

    const interval = setInterval(() => {
      setVisualProgress((prev) => {
        const next = { ...prev };
        
        Object.keys(next).forEach((modelId) => {
          const target = realProgress[modelId] || 0;
          const current = next[modelId];

          const incrementRates: { [key: string]: number } = {
            "cerebras:gpt-oss-120b": 0.5,
            "groq:llama-3.3-70b-versatile": 0.4,
            "openrouter:openrouter/free": 0.25,
            "nvidia:z-ai/glm-5.2": 0.15,
            "nvidia:nvidia/nemotron-3-ultra-550b-a55b": 0.08,
          };
          const increment = incrementRates[modelId] || 0.15;

          if (target === 100) {
            next[modelId] = 100;
          } else if (current < target) {
            next[modelId] = Math.min(target, current + 4);
          } else if (current < 99) {
            next[modelId] = Math.min(99, current + increment);
          }
        });

        return next;
      });

      setVisualPhases((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((modelId) => {
          next[modelId] = realPhases[modelId] || "Queued";
        });
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [status, realProgress, realPhases]);

  useEffect(() => {
    if (status === "success") {
      setVisualProgress({
        "cerebras:gpt-oss-120b": 100,
        "groq:llama-3.3-70b-versatile": 100,
        "openrouter:openrouter/free": 100,
        "nvidia:z-ai/glm-5.2": 100,
        "nvidia:nvidia/nemotron-3-ultra-550b-a55b": 100,
      });
      setVisualPhases({
        "cerebras:gpt-oss-120b": "Ready",
        "groq:llama-3.3-70b-versatile": "Ready",
        "openrouter:openrouter/free": "Ready",
        "nvidia:z-ai/glm-5.2": "Ready",
        "nvidia:nvidia/nemotron-3-ultra-550b-a55b": "Ready",
      });
    }
  }, [status]);

  useEffect(() => {
    const updateCoords = () => {
      if (
        !containerRef.current ||
        !sourceRef.current ||
        !compileRef.current ||
        !summaryRef.current ||
        !experienceRef.current ||
        !projectsRef.current ||
        !skillsRef.current ||
        !matchScoreRef.current
      ) return;

      const containerRect = containerRef.current.getBoundingClientRect();

      const getPoints = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        return {
          left: {
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top + rect.height / 2
          },
          right: {
            x: rect.right - containerRect.left,
            y: rect.top - containerRect.top + rect.height / 2
          }
        };
      };

      setCoords({
        source: getPoints(sourceRef.current).right,
        compile: getPoints(compileRef.current).left,
        summaryLeft: getPoints(summaryRef.current).left,
        summaryRight: getPoints(summaryRef.current).right,
        experienceLeft: getPoints(experienceRef.current).left,
        experienceRight: getPoints(experienceRef.current).right,
        projectsLeft: getPoints(projectsRef.current).left,
        projectsRight: getPoints(projectsRef.current).right,
        skillsLeft: getPoints(skillsRef.current).left,
        skillsRight: getPoints(skillsRef.current).right,
        matchScoreLeft: getPoints(matchScoreRef.current).left,
        matchScoreRight: getPoints(matchScoreRef.current).right
      });
    };

    updateCoords();
    const t1 = setTimeout(updateCoords, 100);
    const t2 = setTimeout(updateCoords, 400);

    const observer = new ResizeObserver(updateCoords);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", updateCoords);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      observer.disconnect();
      window.removeEventListener("resize", updateCoords);
    };
  }, [selectedTab, status]);

  const pVal = visualProgress[selectedTab] || 0;
  const isFinished = status === "success";
  const isCompiling = status === "compiling";

  const getBranchState = (branch: "summary" | "experience" | "projects" | "skills" | "matchScore") => {
    if (isFinished) return { active: false, done: true, ready: false, log: "Completed.", progress: 100 };
    if (isCompiling) return { active: false, done: true, ready: false, log: "Completed.", progress: 100 };
    if (pVal === 100) return { active: false, done: true, ready: false, log: "Completed.", progress: 100 };

    switch (branch) {
      case "summary": {
        if (pVal < 5) return { active: true, done: false, ready: false, log: "Analyzing profile summary...", progress: Math.round((pVal / 5) * 100) };
        if (pVal < 20) return { active: true, done: false, ready: false, log: "Optimizing summary keywords...", progress: Math.round(((pVal - 5) / 15) * 100) };
        return { active: false, done: false, ready: true, log: "Ready to merge.", progress: 100 };
      }
      case "experience": {
        if (pVal < 20) return { active: false, done: false, ready: false, log: "Queued...", progress: 0 };
        if (pVal < 35) return { active: true, done: false, ready: false, log: "Aligning job metrics...", progress: Math.round(((pVal - 20) / 15) * 100) };
        if (pVal < 50) return { active: true, done: false, ready: false, log: "Normalizing highlights...", progress: Math.round(((pVal - 35) / 15) * 100) };
        return { active: false, done: false, ready: true, log: "Ready to merge.", progress: 100 };
      }
      case "projects": {
        if (pVal < 40) return { active: false, done: false, ready: false, log: "Queued...", progress: 0 };
        if (pVal < 55) return { active: true, done: false, ready: false, log: "Matching projects to JD...", progress: Math.round(((pVal - 40) / 15) * 100) };
        if (pVal < 70) return { active: true, done: false, ready: false, log: "Refining tech bullet points...", progress: Math.round(((pVal - 55) / 15) * 100) };
        return { active: false, done: false, ready: true, log: "Ready to merge.", progress: 100 };
      }
      case "skills": {
        if (pVal < 60) return { active: false, done: false, ready: false, log: "Queued...", progress: 0 };
        if (pVal < 75) return { active: true, done: false, ready: false, log: "Sorting skill categories...", progress: Math.round(((pVal - 60) / 15) * 100) };
        if (pVal < 90) return { active: true, done: false, ready: false, log: "Normalizing dynamic fields...", progress: Math.round(((pVal - 75) / 15) * 100) };
        return { active: false, done: false, ready: true, log: "Ready to merge.", progress: 100 };
      }
      case "matchScore": {
        if (pVal < 80) return { active: false, done: false, ready: false, log: "Queued...", progress: 0 };
        if (pVal < 90) return { active: true, done: false, ready: false, log: "Aggregating tailored segments...", progress: Math.round(((pVal - 80) / 10) * 90) };
        return { active: true, done: false, ready: false, log: "Calculating ATS score & keywords...", progress: 90 };
      }
    }
  };

  const summary = getBranchState("summary")!;
  const experience = getBranchState("experience")!;
  const projects = getBranchState("projects")!;
  const skills = getBranchState("skills")!;
  const matchScore = getBranchState("matchScore")!;

  const getPathD = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const dx = Math.abs(end.x - start.x) * 0.5;
    return `M ${start.x},${start.y} C ${start.x + dx},${start.y} ${end.x - dx},${end.y} ${end.x},${end.y}`;
  };

  return (
    <div ref={containerRef} className="w-full mt-4 flex flex-col gap-4 p-6 bg-slate-900/60 border border-white/10 rounded-2xl relative overflow-hidden backdrop-blur-xl">
      <style>{`
        .active-glow-summary { border-color: rgba(129, 140, 248, 0.5) !important; box-shadow: 0 0 15px rgba(129, 140, 248, 0.15); }
        .active-glow-experience { border-color: rgba(167, 139, 250, 0.5) !important; box-shadow: 0 0 15px rgba(167, 139, 250, 0.15); }
        .active-glow-projects { border-color: rgba(244, 114, 182, 0.5) !important; box-shadow: 0 0 15px rgba(244, 114, 182, 0.15); }
        .active-glow-skills { border-color: rgba(45, 212, 191, 0.5) !important; box-shadow: 0 0 15px rgba(45, 212, 191, 0.15); }
        .active-glow-matchScore { border-color: rgba(168, 85, 247, 0.5) !important; box-shadow: 0 0 15px rgba(168, 85, 247, 0.15); }
      `}</style>

      {/* Model tabs at the top */}
      <div className="flex flex-wrap gap-2 mb-4 justify-center border-b border-white/5 pb-3 relative z-20">
        {AI_MODELS.map((model) => {
          const isSelected = model.id === selectedTab;
          const progressVal = Math.round(visualProgress[model.id] || 0);
          const phase = visualPhases[model.id] || "Queued";
          const isReady = phase === "Ready";

          return (
            <button
              type="button"
              key={model.id}
              onClick={() => setSelectedTab(model.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                isSelected 
                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-300'
              }`}
            >
              <img src={model.icon} alt="icon" className="w-4.5 h-4.5 rounded" onError={(e) => e.currentTarget.src='data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>'} />
              <span>{model.name.split(" ")[0]}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                isReady ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'bg-indigo-500/20 text-indigo-400 animate-pulse font-mono'
              }`}>
                {isReady ? "Ready" : `${progressVal}%`}
              </span>
            </button>
          );
        })}
      </div>

      {/* SVG Circuit Lines - Desktop Only */}
      {coords && (
        <div className="hidden md:block absolute inset-0 w-full h-full pointer-events-none z-0">
          <svg className="w-full h-full">
            <defs>
              <filter id="sparkle-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 1. Summary Traces and Sparkles */}
            <path d={getPathD(coords.source, coords.summaryLeft)} fill="none" stroke={summary.ready || summary.done ? "rgba(129, 140, 248, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            <path d={getPathD(coords.summaryRight, coords.compile)} fill="none" stroke={summary.ready || summary.done ? "rgba(129, 140, 248, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            {(!isFinished && pVal > 0) && (
              <circle r="4.5" fill="#818cf8" filter="url(#sparkle-glow)">
                <animateMotion
                  key={`sum-left-${summary.active ? "fast" : "slow"}`}
                  dur={summary.active ? "1.4s" : "2.8s"}
                  repeatCount="indefinite"
                  path={getPathD(coords.source, coords.summaryLeft)}
                />
              </circle>
            )}
            {(!isFinished && summary.ready) && (
              <circle r="4.5" fill="#818cf8" filter="url(#sparkle-glow)">
                <animateMotion
                  key="sum-right-slow"
                  dur="2.8s"
                  repeatCount="indefinite"
                  path={getPathD(coords.summaryRight, coords.compile)}
                />
              </circle>
            )}

            {/* 2. Experience Traces and Sparkles */}
            <path d={getPathD(coords.source, coords.experienceLeft)} fill="none" stroke={experience.ready || experience.done ? "rgba(167, 139, 250, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            <path d={getPathD(coords.experienceRight, coords.compile)} fill="none" stroke={experience.ready || experience.done ? "rgba(167, 139, 250, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            {(!isFinished && pVal >= 20) && (
              <circle r="4.5" fill="#c084fc" filter="url(#sparkle-glow)">
                <animateMotion
                  key={`exp-left-${experience.active ? "fast" : "slow"}`}
                  dur={experience.active ? "1.4s" : "2.8s"}
                  repeatCount="indefinite"
                  path={getPathD(coords.source, coords.experienceLeft)}
                />
              </circle>
            )}
            {(!isFinished && experience.ready) && (
              <circle r="4.5" fill="#c084fc" filter="url(#sparkle-glow)">
                <animateMotion
                  key="exp-right-slow"
                  dur="2.8s"
                  repeatCount="indefinite"
                  path={getPathD(coords.experienceRight, coords.compile)}
                />
              </circle>
            )}

            {/* 3. Projects Traces and Sparkles */}
            <path d={getPathD(coords.source, coords.projectsLeft)} fill="none" stroke={projects.ready || projects.done ? "rgba(244, 114, 182, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            <path d={getPathD(coords.projectsRight, coords.compile)} fill="none" stroke={projects.ready || projects.done ? "rgba(244, 114, 182, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            {(!isFinished && pVal >= 40) && (
              <circle r="4.5" fill="#f472b6" filter="url(#sparkle-glow)">
                <animateMotion
                  key={`proj-left-${projects.active ? "fast" : "slow"}`}
                  dur={projects.active ? "1.4s" : "2.8s"}
                  repeatCount="indefinite"
                  path={getPathD(coords.source, coords.projectsLeft)}
                />
              </circle>
            )}
            {(!isFinished && projects.ready) && (
              <circle r="4.5" fill="#f472b6" filter="url(#sparkle-glow)">
                <animateMotion
                  key="proj-right-slow"
                  dur="2.8s"
                  repeatCount="indefinite"
                  path={getPathD(coords.projectsRight, coords.compile)}
                />
              </circle>
            )}

            {/* 4. Skills Traces and Sparkles */}
            <path d={getPathD(coords.source, coords.skillsLeft)} fill="none" stroke={skills.ready || skills.done ? "rgba(45, 212, 191, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            <path d={getPathD(coords.skillsRight, coords.compile)} fill="none" stroke={skills.ready || skills.done ? "rgba(45, 212, 191, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            {(!isFinished && pVal >= 60) && (
              <circle r="4.5" fill="#2dd4bf" filter="url(#sparkle-glow)">
                <animateMotion
                  key={`sk-left-${skills.active ? "fast" : "slow"}`}
                  dur={skills.active ? "1.4s" : "2.8s"}
                  repeatCount="indefinite"
                  path={getPathD(coords.source, coords.skillsLeft)}
                />
              </circle>
            )}
            {(!isFinished && skills.ready) && (
              <circle r="4.5" fill="#2dd4bf" filter="url(#sparkle-glow)">
                <animateMotion
                  key="sk-right-slow"
                  dur="2.8s"
                  repeatCount="indefinite"
                  path={getPathD(coords.skillsRight, coords.compile)}
                />
              </circle>
            )}

            {/* 5. Match & Score Traces and Sparkles */}
            <path d={getPathD(coords.source, coords.matchScoreLeft)} fill="none" stroke={matchScore.done ? "rgba(168, 85, 247, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            <path d={getPathD(coords.matchScoreRight, coords.compile)} fill="none" stroke={matchScore.done ? "rgba(168, 85, 247, 0.35)" : "rgba(255,255,255,0.04)"} strokeWidth="2.5" className="transition-colors duration-500" />
            {(!isFinished && pVal >= 80) && (
              <circle r="4.5" fill="#a855f7" filter="url(#sparkle-glow)">
                <animateMotion
                  key={`ms-left-${matchScore.active ? "fast" : "slow"}`}
                  dur={matchScore.active ? "1.4s" : "2.8s"}
                  repeatCount="indefinite"
                  path={getPathD(coords.source, coords.matchScoreLeft)}
                />
              </circle>
            )}
          </svg>
        </div>
      )}

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 min-h-[500px] md:px-8 w-full">
        {/* 1. Source Node */}
        <div className="w-full md:w-[15%] flex flex-col items-center justify-center">
          <div ref={sourceRef} className={`p-5 rounded-2xl bg-slate-950/80 border border-white/10 flex flex-col items-center gap-2 text-center w-full max-w-[160px] transition-all duration-500 ${!isFinished ? "border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]" : "border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.05)]"}`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${!isFinished ? "bg-indigo-500/20 text-indigo-400 animate-pulse" : "bg-emerald-500/20 text-emerald-400"}`}>
              {!isFinished ? (
                <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              )}
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Data Source</span>
            <span className="text-[10px] text-slate-500 leading-tight">Resume & JD Loaded</span>
          </div>
        </div>

        {/* 2. Middle Parallel Branches */}
        <div className="w-full md:w-[45%] flex flex-col gap-3 px-2">
          {/* Branch A: Summary */}
          <div ref={summaryRef} className={`rounded-xl bg-slate-950/70 border overflow-hidden transition-all duration-300 ${summary.done ? "border-emerald-500/20" : summary.ready ? "border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.05)]" : summary.active ? "active-glow-summary" : "border-white/5"}`}>
            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${summary.done ? "bg-emerald-500/25 text-emerald-400" : summary.ready ? "bg-indigo-500/25 text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.2)]" : summary.active ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-slate-600"}`}>
                  {summary.done || summary.ready ? "✓" : "A"}
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${summary.done ? "text-slate-200" : summary.ready ? "text-indigo-300" : summary.active ? "text-indigo-300" : "text-slate-200"}`}>Summary Tailoring</span>
                  <span className={`text-[10px] ${summary.ready ? "text-indigo-400/80" : "text-slate-500"}`}>{summary.log}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mr-2">
                {summary.progress > 0 && <span className="text-[9px] font-mono text-slate-500">{summary.progress}%</span>}
                {summary.active && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping"></span>}
                {summary.ready && !summary.done && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_4px_#818cf8]"></span>}
              </div>
            </div>
            <div className="h-[2px] w-full bg-white/5">
              <div className={`h-full transition-all duration-700 ease-out ${summary.done ? "bg-emerald-500" : summary.ready ? "bg-indigo-400" : "bg-gradient-to-r from-indigo-500 to-purple-500"}`} style={{ width: `${summary.progress}%` }} />
            </div>
          </div>

          {/* Branch B: Experience */}
          <div ref={experienceRef} className={`rounded-xl bg-slate-950/70 border overflow-hidden transition-all duration-300 ${experience.done ? "border-emerald-500/20" : experience.ready ? "border-purple-500/30 shadow-[0_0_10px_rgba(167,139,250,0.05)]" : experience.active ? "active-glow-experience" : "border-white/5"}`}>
            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${experience.done ? "bg-emerald-500/25 text-emerald-400" : experience.ready ? "bg-purple-500/25 text-purple-400 shadow-[0_0_8px_rgba(167,139,250,0.2)]" : experience.active ? "bg-purple-500/20 text-purple-400" : "bg-white/5 text-slate-600"}`}>
                  {experience.done || experience.ready ? "✓" : "B"}
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${experience.done ? "text-slate-200" : experience.ready ? "text-purple-300" : experience.active ? "text-purple-300" : "text-slate-200"}`}>Experience Alignment</span>
                  <span className={`text-[10px] ${experience.ready ? "text-purple-400/80" : "text-slate-500"}`}>{experience.log}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mr-2">
                {experience.progress > 0 && <span className="text-[9px] font-mono text-slate-500">{experience.progress}%</span>}
                {experience.active && <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping"></span>}
                {experience.ready && !experience.done && <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_4px_#a78bfa]"></span>}
              </div>
            </div>
            <div className="h-[2px] w-full bg-white/5">
              <div className={`h-full transition-all duration-700 ease-out ${experience.done ? "bg-emerald-500" : experience.ready ? "bg-purple-400" : "bg-gradient-to-r from-purple-500 to-pink-500"}`} style={{ width: `${experience.progress}%` }} />
            </div>
          </div>

          {/* Branch C: Projects */}
          <div ref={projectsRef} className={`rounded-xl bg-slate-950/70 border overflow-hidden transition-all duration-300 ${projects.done ? "border-emerald-500/20" : projects.ready ? "border-pink-500/30 shadow-[0_0_10px_rgba(244,114,182,0.05)]" : projects.active ? "active-glow-projects" : "border-white/5"}`}>
            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${projects.done ? "bg-emerald-500/25 text-emerald-400" : projects.ready ? "bg-pink-500/25 text-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.2)]" : projects.active ? "bg-pink-500/20 text-pink-400" : "bg-white/5 text-slate-600"}`}>
                  {projects.done || projects.ready ? "✓" : "C"}
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${projects.done ? "text-slate-200" : projects.ready ? "text-pink-300" : projects.active ? "text-pink-300" : "text-slate-200"}`}>Project Optimization</span>
                  <span className={`text-[10px] ${projects.ready ? "text-pink-400/80" : "text-slate-500"}`}>{projects.log}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mr-2">
                {projects.progress > 0 && <span className="text-[9px] font-mono text-slate-500">{projects.progress}%</span>}
                {projects.active && <span className="h-1.5 w-1.5 rounded-full bg-pink-400 animate-ping"></span>}
                {projects.ready && !projects.done && <span className="h-1.5 w-1.5 rounded-full bg-pink-400 shadow-[0_0_4px_#f472b6]"></span>}
              </div>
            </div>
            <div className="h-[2px] w-full bg-white/5">
              <div className={`h-full transition-all duration-700 ease-out ${projects.done ? "bg-emerald-500" : projects.ready ? "bg-pink-400" : "bg-gradient-to-r from-pink-500 to-rose-500"}`} style={{ width: `${projects.progress}%` }} />
            </div>
          </div>

          {/* Branch D: Skills */}
          <div ref={skillsRef} className={`rounded-xl bg-slate-950/70 border overflow-hidden transition-all duration-300 ${skills.done ? "border-emerald-500/20" : skills.ready ? "border-teal-500/30 shadow-[0_0_10px_rgba(45,212,191,0.05)]" : skills.active ? "active-glow-skills" : "border-white/5"}`}>
            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${skills.done ? "bg-emerald-500/25 text-emerald-400" : skills.ready ? "bg-teal-500/25 text-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.2)]" : skills.active ? "bg-teal-500/20 text-teal-400" : "bg-white/5 text-slate-600"}`}>
                  {skills.done || skills.ready ? "✓" : "D"}
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${skills.done ? "text-slate-200" : skills.ready ? "text-teal-300" : skills.active ? "text-teal-300" : "text-slate-200"}`}>Skills Prioritization</span>
                  <span className={`text-[10px] ${skills.ready ? "text-teal-400/80" : "text-slate-500"}`}>{skills.log}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mr-2">
                {skills.progress > 0 && <span className="text-[9px] font-mono text-slate-500">{skills.progress}%</span>}
                {skills.active && <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-ping"></span>}
                {skills.ready && !skills.done && <span className="h-1.5 w-1.5 rounded-full bg-teal-400 shadow-[0_0_4px_#2dd4bf]"></span>}
              </div>
            </div>
            <div className="h-[2px] w-full bg-white/5">
              <div className={`h-full transition-all duration-700 ease-out ${skills.done ? "bg-emerald-500" : skills.ready ? "bg-teal-400" : "bg-gradient-to-r from-teal-500 to-cyan-500"}`} style={{ width: `${skills.progress}%` }} />
            </div>
          </div>

          {/* Branch E: Match & Score */}
          <div ref={matchScoreRef} className={`rounded-xl bg-slate-950/70 border overflow-hidden transition-all duration-300 ${matchScore.done ? "border-emerald-500/20" : matchScore.active ? "active-glow-matchScore" : "border-white/5"}`}>
            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${matchScore.done ? "bg-emerald-500/25 text-emerald-400" : matchScore.active ? "bg-purple-500/25 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.2)]" : "bg-white/5 text-slate-600"}`}>
                  {matchScore.done ? "✓" : "E"}
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${matchScore.done ? "text-slate-200" : matchScore.active ? "text-purple-300" : "text-slate-200"}`}>Match & Score Analysis</span>
                  <span className={`text-[10px] ${matchScore.active ? "text-purple-400/80" : "text-slate-500"}`}>{matchScore.log}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mr-2">
                {matchScore.progress > 0 && <span className="text-[9px] font-mono text-slate-500">{matchScore.progress}%</span>}
                {matchScore.active && !matchScore.done && <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping"></span>}
              </div>
            </div>
            <div className="h-[2px] w-full bg-white/5">
              <div className={`h-full transition-all duration-700 ease-out ${matchScore.done ? "bg-emerald-500" : "bg-gradient-to-r from-purple-500 to-pink-500"}`} style={{ width: `${matchScore.progress}%` }} />
            </div>
          </div>
        </div>

        {/* 3. Output Node */}
        <div className="w-full md:w-[15%] flex flex-col items-center justify-center">
          <div ref={compileRef} className={`p-5 rounded-2xl bg-slate-950/80 border border-white/10 flex flex-col items-center gap-2 text-center w-full max-w-[160px] transition-all duration-500 ${isCompiling ? "border-pink-500/50 shadow-[0_0_20px_rgba(244,114,182,0.2)]" : (isFinished || pVal === 100) ? "border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]" : "opacity-40"}`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCompiling ? "bg-pink-500/20 text-pink-400" : (isFinished || pVal === 100) ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-500"}`}>
              {isCompiling ? (
                <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H20" /></svg>
              )}
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">PDF Compile</span>
            <span className="text-[10px] text-slate-500 leading-tight">
              {isCompiling ? "Compiling LaTeX..." : (isFinished || pVal === 100) ? "Ready to Compile" : "Awaiting Merges"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<"file" | "latex">("file");
  const [file, setFile] = useState<File | null>(null);
  const [jdText, setJdText] = useState("");
  const [latexText, setLatexText] = useState("");
  const [status, setStatus] = useState<"idle" | "parsing" | "tailoring" | "compiling" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [generatedLatexLength, setGeneratedLatexLength] = useState<number | null>(null);
  
  const [primaryModel, setPrimaryModel] = useState(AI_MODELS[0].id);

  // Multi-model states
  const [tailoredResumes, setTailoredResumes] = useState<any[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);
  const [isCompilingSelected, setIsCompilingSelected] = useState<boolean>(false);

  // Real-time parallel progress streaming states
  const [parallelProgress, setParallelProgress] = useState<{ [key: string]: number }>({
    "cerebras:gpt-oss-120b": 0,
    "groq:llama-3.3-70b-versatile": 0,
    "openrouter:openrouter/free": 0,
    "nvidia:z-ai/glm-5.2": 0,
    "nvidia:nvidia/nemotron-3-ultra-550b-a55b": 0,
  });

  const [parallelPhases, setParallelPhases] = useState<{ [key: string]: string }>({
    "cerebras:gpt-oss-120b": "Queued",
    "groq:llama-3.3-70b-versatile": "Queued",
    "openrouter:openrouter/free": "Queued",
    "nvidia:z-ai/glm-5.2": "Queued",
    "nvidia:nvidia/nemotron-3-ultra-550b-a55b": "Queued",
  });

  // Load all persisted states on mount
  useEffect(() => {
    const savedActiveTab = localStorage.getItem("activeTab");
    if (savedActiveTab === "file" || savedActiveTab === "latex") {
      setActiveTab(savedActiveTab);
    }

    const savedJd = localStorage.getItem("jdText");
    if (savedJd) setJdText(savedJd);

    const savedLatex = localStorage.getItem("savedLatex");
    if (savedLatex) setLatexText(savedLatex);

    const savedModel = localStorage.getItem("primaryModel");
    if (savedModel) setPrimaryModel(savedModel);

    const savedResumesStr = localStorage.getItem("tailoredResumes");
    const savedStatus = localStorage.getItem("status");
    if (savedResumesStr && savedStatus) {
      try {
        const parsed = JSON.parse(savedResumesStr);
        setTailoredResumes(parsed);
        setStatus(savedStatus as any);
      } catch (e) {
        console.error("Failed to parse saved tailored resumes", e);
      }
    }

    const savedIdx = localStorage.getItem("selectedResultIndex");
    if (savedIdx) setSelectedResultIndex(Number(savedIdx));

    const savedDownloadName = localStorage.getItem("downloadName");
    if (savedDownloadName) setDownloadName(savedDownloadName);

    const savedGenLen = localStorage.getItem("generatedLatexLength");
    if (savedGenLen) setGeneratedLatexLength(Number(savedGenLen));
  }, []);

  // Save states to localStorage on changes
  useEffect(() => {
    localStorage.setItem("activeTab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem("jdText", jdText);
  }, [jdText]);

  useEffect(() => {
    localStorage.setItem("primaryModel", primaryModel);
  }, [primaryModel]);

  useEffect(() => {
    if (tailoredResumes.length > 0) {
      localStorage.setItem("tailoredResumes", JSON.stringify(tailoredResumes));
      localStorage.setItem("status", status);
    } else {
      localStorage.removeItem("tailoredResumes");
      localStorage.removeItem("status");
    }
  }, [tailoredResumes, status]);

  useEffect(() => {
    localStorage.setItem("selectedResultIndex", String(selectedResultIndex));
  }, [selectedResultIndex]);

  useEffect(() => {
    if (downloadName) {
      localStorage.setItem("downloadName", downloadName);
    } else {
      localStorage.removeItem("downloadName");
    }
  }, [downloadName]);

  useEffect(() => {
    if (generatedLatexLength !== null) {
      localStorage.setItem("generatedLatexLength", String(generatedLatexLength));
    } else {
      localStorage.removeItem("generatedLatexLength");
    }
  }, [generatedLatexLength]);

  const handleLatexChange = (val: string) => {
    setLatexText(val);
    if (val) {
      localStorage.setItem("savedLatex", val);
    } else {
      localStorage.removeItem("savedLatex");
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setErrorMessage("");
    setPdfUrl(null);
    setDownloadName("");
    setGeneratedLatexLength(null);
    setTailoredResumes([]);
    setSelectedResultIndex(0);

    // Clear persisted result/status data in localStorage
    localStorage.removeItem("tailoredResumes");
    localStorage.removeItem("status");
    localStorage.removeItem("selectedResultIndex");
    localStorage.removeItem("downloadName");
    localStorage.removeItem("generatedLatexLength");
  };

  const compilePdfForIndex = async (index: number, resultsList: any[]) => {
    const result = resultsList[index];
    if (!result || !result.latex) return;

    setIsCompilingSelected(true);
    setPdfUrl(null);

    try {
      const compileRes = await fetch(`${API_BASE_URL}/api/generate-latex-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex: result.latex }),
      });

      if (!compileRes.ok) {
        const errDetails = await compileRes.json();
        throw new Error(errDetails.error || "LaTeX compilation failed");
      }

      const blob = await compileRes.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`Failed to compile PDF for ${result.modelName}: ${err.message}`);
    } finally {
      setIsCompilingSelected(false);
    }
  };

  const handleSelectModel = async (index: number) => {
    if (index === selectedResultIndex) return;
    setSelectedResultIndex(index);
    const result = tailoredResumes[index];
    setGeneratedLatexLength(result.generatedLength);
    
    await compilePdfForIndex(index, tailoredResumes);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    if (activeTab === "latex") {
      if (!latexText.trim() || !jdText.trim()) {
        setErrorMessage("Please provide both your LaTeX code and a job description.");
        setStatus("error");
        return;
      }
    } else {
      if (!file || !jdText.trim()) {
        setErrorMessage("Please provide both a resume file and a job description.");
        setStatus("error");
        return;
      }
    }

    try {
      setErrorMessage("");
      setPdfUrl(null);
      setGeneratedLatexLength(null);
      setTailoredResumes([]);
      setSelectedResultIndex(0);

      if (activeTab === "latex") {
        setStatus("parsing");
        // Parse the JD first
        const jdRes = await fetch(`${API_BASE_URL}/api/parse-jd`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: jdText, modelSelection: { primaryModel } }),
        });
        if (!jdRes.ok) throw new Error("Failed to parse job description");
        const jdData = await jdRes.json();

        const jobTitle = jdData?.jobTitle?.trim().replace(/[^a-zA-Z0-9]/g, "_") || "Professional";
        const candidateName = extractCandidateNameFromLatex(latexText);
        setDownloadName(`${candidateName}_${jobTitle}_Resume.pdf`);

        setStatus("tailoring");
        
        // Initialize parallel progress states
        setParallelProgress({
          "cerebras:gpt-oss-120b": 0,
          "groq:llama-3.3-70b-versatile": 0,
          "openrouter:openrouter/free": 0,
          "nvidia:z-ai/glm-5.2": 0,
          "nvidia:nvidia/nemotron-3-ultra-550b-a55b": 0,
        });
        setParallelPhases({
          "cerebras:gpt-oss-120b": "Queued",
          "groq:llama-3.3-70b-versatile": "Queued",
          "openrouter:openrouter/free": "Queued",
          "nvidia:z-ai/glm-5.2": "Queued",
          "nvidia:nvidia/nemotron-3-ultra-550b-a55b": "Queued",
        });

        // Use direct LaTeX tailor endpoint (which streams updates for the 5 models in parallel)
        const tailorRes = await fetch(`${API_BASE_URL}/api/tailor-latex-direct`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latex: latexText, jdData }),
        });
        if (!tailorRes.ok) {
          throw new Error("Failed to tailor LaTeX directly");
        }

        const reader = tailorRes.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const accumulatedResults: any[] = [];

        const currentProgress = {
          "cerebras:gpt-oss-120b": 0,
          "groq:llama-3.3-70b-versatile": 0,
          "openrouter:openrouter/free": 0,
          "nvidia:z-ai/glm-5.2": 0,
          "nvidia:nvidia/nemotron-3-ultra-550b-a55b": 0,
        };

        const currentPhases = {
          "cerebras:gpt-oss-120b": "Queued",
          "groq:llama-3.3-70b-versatile": "Queued",
          "openrouter:openrouter/free": "Queued",
          "nvidia:z-ai/glm-5.2": "Queued",
          "nvidia:nvidia/nemotron-3-ultra-550b-a55b": "Queued",
        };

        if (reader) {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const event = JSON.parse(line);
                const { modelId, progress: p, phase, result } = event;

                if (modelId) {
                  currentProgress[modelId as keyof typeof currentProgress] = p;
                  currentPhases[modelId as keyof typeof currentPhases] = phase;

                  setParallelProgress({ ...currentProgress });
                  setParallelPhases({ ...currentPhases });

                  if (result) {
                    const existingIdx = accumulatedResults.findIndex(r => r.modelId === modelId);
                    if (existingIdx !== -1) {
                      accumulatedResults[existingIdx] = result;
                    } else {
                      accumulatedResults.push(result);
                    }

                    // Update React state in real-time so completed models display immediately
                    const sortedTemp = [...accumulatedResults].sort((a, b) => {
                      if (a.error && !b.error) return 1;
                      if (!a.error && b.error) return -1;
                      return b.score - a.score;
                    });
                    setTailoredResumes(sortedTemp);
                  }
                }
              } catch (e) {
                console.error("Error parsing stream event line:", e, line);
              }
            }
          }
        }

        // Sort final results by score descending (failed at bottom)
        const sortedResults = [...accumulatedResults].sort((a, b) => {
          if (a.error && !b.error) return 1;
          if (!a.error && b.error) return -1;
          return b.score - a.score;
        });

        if (sortedResults.length === 0) {
          throw new Error("All models failed to generate tailored LaTeX");
        }

        setTailoredResumes(sortedResults);
        setSelectedResultIndex(0);

        const bestResult = sortedResults.find(r => !r.error && r.latex) || sortedResults[0];
        setGeneratedLatexLength(bestResult.generatedLength);

        setStatus("compiling");
        const compileRes = await fetch(`${API_BASE_URL}/api/generate-latex-pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latex: bestResult.latex }),
        });
        
        if (!compileRes.ok) {
          const errDetails = await compileRes.json();
          throw new Error(errDetails.error || "LaTeX compilation failed");
        }

        const blob = await compileRes.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setStatus("success");
        return;
      }

      // Original file-based flow
      setStatus("parsing");
      const formData = new FormData();
      formData.append("file", file!);
      formData.append("primaryModel", primaryModel);
      
      const parseRes = await fetch(`${API_BASE_URL}/api/parse-resume`, {
        method: "POST",
        body: formData,
      });
      if (!parseRes.ok) throw new Error("Failed to parse resume file");
      const resumeData = await parseRes.json();

      const jdRes = await fetch(`${API_BASE_URL}/api/parse-jd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: jdText, modelSelection: { primaryModel } }),
      });
      if (!jdRes.ok) throw new Error("Failed to parse job description");
      const jdData = await jdRes.json();

      setStatus("tailoring");
      const tailorRes = await fetch(`${API_BASE_URL}/api/tailor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeData, jdData, modelSelection: { primaryModel } }),
      });
      if (!tailorRes.ok) throw new Error("Failed to tailor resume");
      const tailoredResult = await tailorRes.json();
      
      const candidateName = tailoredResult.tailoredResume?.name?.trim().replace(/[^a-zA-Z0-9]/g, "_") || "Candidate";
      const jobTitle = jdData?.jobTitle?.trim().replace(/[^a-zA-Z0-9]/g, "_") || "Professional";
      setDownloadName(`${candidateName}_${jobTitle}_Resume.pdf`);

      setStatus("compiling");
      const compileRes = await fetch(`${API_BASE_URL}/api/generate-latex-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tailoredResume: tailoredResult.tailoredResume }),
      });
      
      if (!compileRes.ok) {
        const errDetails = await compileRes.json();
        throw new Error(errDetails.error || "LaTeX compilation failed");
      }

      const blob = await compileRes.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setStatus("success");

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An unexpected error occurred");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-radial from-[#121324] via-[#090a10] to-[#040408] text-slate-100 font-sans antialiased">
      {/* Navbar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="font-bold text-lg text-white tracking-wider">RT</span>
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
            Resume Tailor
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            API Live
          </span>
        </div>
      </header>

      {/* Main Hero & Tool */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12 flex flex-col items-center">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
            Perfect LaTeX Resumes,{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
              Zero Code.
            </span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Upload your resume, paste the job description, and instantly download a 1-page, beautifully formatted ATS-friendly PDF.
          </p>
        </div>

        {/* Generator Tool */}
        <div className="w-full max-w-4xl bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col gap-6">
            
            {/* Tabs */}
            <div className="flex gap-4 border-b border-white/10 pb-2">
              <button
                type="button"
                onClick={() => { setActiveTab("file"); handleReset(); }}
                className={`py-2 px-4 font-semibold text-sm border-b-2 transition-all ${activeTab === "file" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-300"}`}
              >
                Tailor Resume (File + JD)
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("latex"); handleReset(); }}
                className={`py-2 px-4 font-semibold text-sm border-b-2 transition-all ${activeTab === "latex" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-300"}`}
              >
                Compile LaTeX Directly
              </button>
            </div>

            {activeTab === "file" ? (
              <div className="flex flex-col gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">1. Upload Base Resume (PDF/DOCX)</label>
                  <div className="relative">
                    <input 
                      key={fileKey}
                      type="file" 
                      accept=".pdf,.docx"
                      onChange={handleFileChange}
                      className="block w-full text-sm text-slate-400
                        file:mr-4 file:py-3 file:px-6
                        file:rounded-xl file:border-0
                        file:text-sm file:font-semibold
                        file:bg-indigo-500/10 file:text-indigo-400
                        hover:file:bg-indigo-500/20 file:transition-colors
                        cursor-pointer bg-white/5 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">2. Paste Job Description</label>
                  <textarea 
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    placeholder="Paste the target job description here..."
                    rows={6}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none"
                  ></textarea>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col">
                  <div className="flex justify-between items-end mb-2 min-h-[24px]">
                    <label className="block text-sm font-semibold text-slate-300">1. Paste Base LaTeX Code</label>
                    <span className="text-xs text-slate-400 font-mono">
                      {latexText.length} chars
                      {generatedLatexLength !== null && (
                        <span className={`ml-2 font-bold ${generatedLatexLength > latexText.length ? "text-red-400" : "text-emerald-400"}`}>
                          → {generatedLatexLength} generated
                        </span>
                      )}
                    </span>
                  </div>
                  <textarea 
                    value={latexText}
                    onChange={(e) => handleLatexChange(e.target.value)}
                    placeholder="Paste your raw LaTeX resume code here..."
                    rows={16}
                    className="w-full flex-1 bg-white/5 border border-white/10 rounded-xl p-4 text-slate-200 placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none"
                  ></textarea>
                </div>
                <div className="flex flex-col">
                  <div className="flex justify-between items-end mb-2 min-h-[24px]">
                    <label className="block text-sm font-semibold text-slate-300">2. Paste Job Description</label>
                  </div>
                  <textarea 
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    placeholder="Paste the target job description here..."
                    rows={16}
                    className="w-full flex-1 bg-white/5 border border-white/10 rounded-xl p-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none"
                  ></textarea>
                </div>
              </div>
            )}

            {/* Always Visible: AI Model Selection */}
            {activeTab === "file" ? (
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">3. AI Model Preferences</label>
                <div className="grid grid-cols-1 gap-4">
                  <CustomDropdown
                    label="AI Model"
                    value={primaryModel}
                    onChange={setPrimaryModel}
                    options={AI_MODELS}
                    focusColor="border-indigo-500/50"
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse"></div>
                <p className="text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Parallel Power Tailoring active:</span> Generates resume variations using 5 AI models simultaneously, then scores and ranks them against the JD using an ATS simulator.
                </p>
              </div>
            )}

            {/* Status & Actions */}
            <div className="flex flex-col items-center gap-4 mt-2">
              
              {status === "error" && (
                <div className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium text-center">
                  {errorMessage}
                </div>
              )}

              {["parsing", "tailoring", "compiling"].includes(status) && (
                activeTab === "latex" ? (
                  <ParallelPipelineVisualizer 
                    status={status} 
                    progress={parallelProgress} 
                    activePhases={parallelPhases} 
                  />
                ) : (
                  <PipelineVisualizer status={status} />
                )
              )}

              {/* Leaderboard/Detailed Reports (shown in real-time as models finish) */}
              {tailoredResumes.length > 0 && (
                <div className="flex flex-col items-center gap-6 w-full mt-4">
                  {status === "success" && (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium text-center w-full">
                      Success! Tailored resumes generated using 5 models and analyzed by ATS Scoring Engine.
                    </div>
                  )}

                  <div className="w-full flex flex-col gap-6 text-left">
                    {/* ATS Leaderboard Heading */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-200">ATS Match Leaderboard</h3>
                      <p className="text-xs text-slate-400">
                        {status === "success" 
                          ? "Click any model below to preview its ATS report and download its PDF."
                          : "Models are tailoring in parallel. You can click any finished model below to compile and download its resume immediately."}
                      </p>
                    </div>

                    {/* Grid of Results (Leaderboard Cards) */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      {tailoredResumes.map((result, idx) => {
                        const isSelected = idx === selectedResultIndex;
                        const hasError = !!result.error;
                        
                        const scoreColor = hasError
                          ? "text-red-400 border-red-500/30 bg-red-500/5"
                          : result.score >= 85 
                            ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" 
                            : result.score >= 70 
                              ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/5" 
                              : "text-red-400 border-red-500/30 bg-red-500/5";

                        return (
                          <div 
                            key={result.modelId}
                            onClick={() => handleSelectModel(idx)}
                            className={`flex flex-col gap-2 p-4 rounded-xl border cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10 scale-[1.02]' 
                                : hasError
                                  ? 'border-red-500/10 bg-red-500/5 opacity-60 hover:opacity-100 hover:bg-red-500/10'
                                  : 'border-white/10 bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rank {idx + 1}</span>
                              {hasError ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 font-bold">FAIL</span>
                              ) : (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-mono ${scoreColor}`}>
                                  {result.score}%
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <img src={AI_MODELS.find(m => m.id === result.modelId)?.icon} className="w-4 h-4 rounded" onError={(e) => e.currentTarget.style.display='none'} />
                              <span className="text-xs font-bold text-slate-200 truncate">{result.modelName.split(" ")[0]}</span>
                            </div>

                            {!hasError && (
                              <div className="flex flex-col gap-1 mt-2 border-t border-white/5 pt-2 text-[10px]">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Length check:</span>
                                  <span className={result.lengthCheck.status === "fit" ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                                    {result.lengthCheck.status === "fit" ? "Fit" : "Over"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Characters:</span>
                                  <span className="text-slate-300 font-mono">{result.lengthCheck.length} / {result.lengthCheck.maxLength}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Active detailed scorecard report */}
                    {(() => {
                      const activeResult = tailoredResumes[selectedResultIndex];
                      if (!activeResult) return null;

                      if (activeResult.error) {
                        return (
                          <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-2xl flex flex-col gap-4 relative overflow-hidden">
                            <div className="flex items-center gap-3 text-red-400">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                              <h4 className="font-bold text-base">Model Execution Failed ({activeResult.modelName})</h4>
                            </div>
                            <p className="text-sm text-slate-300">
                              This model failed to generate a tailored resume due to an API error or rate limit exhaustion:
                            </p>
                            <div className="p-4 bg-black/40 rounded-xl font-mono text-xs text-red-300 border border-red-500/10 break-words">
                              {activeResult.error}
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Don't worry! The other models executed independently. Please click on any of the successful model cards above to view their match scores and download their tailored PDFs.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="p-6 bg-slate-900/60 border border-white/10 rounded-2xl flex flex-col md:flex-row gap-6 relative overflow-hidden">
                          {/* Left Panel: Score and Compile status */}
                          <div className="flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/10 pb-6 md:pb-0 md:pr-6 min-w-[200px]">
                            <span className="text-xs text-slate-400 uppercase font-semibold mb-2">ATS Score</span>
                            <div className={`text-5xl font-black mb-2 ${activeResult.score >= 85 ? 'text-emerald-400' : activeResult.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {activeResult.score}%
                            </div>
                            <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-center max-w-full truncate mb-4">
                              {activeResult.modelName}
                            </span>

                            {/* Action Download / Compile State */}
                            {isCompilingSelected ? (
                              <div className="flex flex-col items-center gap-2 mt-2">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
                                <span className="text-xs text-slate-400">Compiling PDF...</span>
                              </div>
                            ) : pdfUrl ? (
                              <a 
                                href={pdfUrl || undefined} 
                                download={downloadName}
                                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-center w-full"
                              >
                                Download PDF
                              </a>
                            ) : (
                              <button
                                onClick={() => compilePdfForIndex(selectedResultIndex, tailoredResumes)}
                                className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 text-center w-full"
                              >
                                Compile PDF
                              </button>
                            )}
                          </div>

                          {/* Right Panel: ATS Feedback */}
                          <div className="flex-1 flex flex-col gap-4">
                            <div>
                              <h4 className="text-sm font-bold text-slate-300">ATS Feedback Reasoning</h4>
                              <p className="text-sm text-slate-400 mt-1 leading-relaxed">{activeResult.reasoning}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                              {/* Matched Keywords */}
                              <div>
                                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                                  Matched Keywords ({activeResult.matchedKeywords.length})
                                </span>
                                <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                                  {activeResult.matchedKeywords.length > 0 ? (
                                    activeResult.matchedKeywords.map((kw: string) => (
                                      <span key={kw} className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                                        {kw}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-slate-500">None detected.</span>
                                  )}
                                </div>
                              </div>

                              {/* Missing Keywords */}
                              <div>
                                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                  Areas for Improvement ({activeResult.missingKeywords.length})
                                </span>
                                <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                                  {activeResult.missingKeywords.length > 0 ? (
                                    activeResult.missingKeywords.map((kw: string) => (
                                      <span key={kw} className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                        {kw}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-slate-500">None detected.</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                    <button 
                      onClick={handleGenerate}
                      disabled={["parsing", "tailoring", "compiling"].includes(status)}
                      className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-center"
                    >
                      Regenerate
                    </button>
                    <button 
                      onClick={handleReset}
                      disabled={["parsing", "tailoring", "compiling"].includes(status)}
                      className="w-full sm:w-auto px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}

              {/* Single Model (File Flow) Success View */}
              {status === "success" && tailoredResumes.length === 0 && (
                <div className="flex flex-col items-center gap-6 w-full mt-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium text-center w-full">
                    Success! Your resume has been tailored and compiled successfully.
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                    <a 
                      href={pdfUrl || undefined} 
                      download={downloadName}
                      className="w-full sm:w-auto px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-center"
                    >
                      Download PDF
                    </a>
                    <button 
                      onClick={handleGenerate}
                      className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 text-center"
                    >
                      Regenerate
                    </button>
                    <button 
                      onClick={handleReset}
                      className="w-full sm:w-auto px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all text-center"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}

              {/* Initial state Generate Button */}
              {status !== "success" && tailoredResumes.length === 0 && (
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center mt-4">
                  <button 
                    onClick={handleGenerate}
                    disabled={["parsing", "tailoring", "compiling"].includes(status)}
                    className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-center"
                  >
                    {["parsing", "tailoring", "compiling"].includes(status) ? "Processing..." : "Generate Tailored PDF"}
                  </button>
                  {(file || jdText || latexText) && (
                    <button 
                      onClick={handleReset}
                      disabled={["parsing", "tailoring", "compiling"].includes(status)}
                      className="w-full sm:w-auto px-8 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}
            </div>
            
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Resume Tailor. All rights reserved.</p>
        <div className="flex gap-6">
          <span>Powered by Multi-Provider AI & LaTeX.</span>
        </div>
      </footer>
    </div>
  );
}
