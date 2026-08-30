"use client";

import React, { useState } from "react";
import { SkillBank, JDMatchResult, matchSkillBankWithJD } from "../../lib/skill-bank";

interface SkillBankCardProps {
  skillBank: SkillBank | null;
  onScanSuccess: (bank: SkillBank) => void;
  onClearBank: () => void;
  jdText: string;
  useSkillBankInTailoring: boolean;
  setUseSkillBankInTailoring: (val: boolean) => void;
}

export default function SkillBankCard({
  skillBank,
  onScanSuccess,
  onClearBank,
  jdText,
  useSkillBankInTailoring,
  setUseSkillBankInTailoring,
}: SkillBankCardProps) {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [authMode, setAuthMode] = useState<"token" | "username">("username");
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [activeCategory, setActiveCategory] = useState<"All" | "Languages" | "Frameworks" | "Databases" | "ToolsAndCloud" | "Projects">("All");

  const handleScan = async () => {
    setIsScanning(true);
    setScanError("");

    try {
      const bodyPayload = authMode === "token" ? { token } : { username };
      const res = await fetch("/api/github/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "GitHub scan failed");
      }

      onScanSuccess(data.skillBank);
    } catch (err: any) {
      console.error(err);
      setScanError(err.message || "Failed to scan GitHub profile");
    } finally {
      setIsScanning(false);
    }
  };

  // Compute JD Match Matrix if both JD text and SkillBank are available
  const matchResult: JDMatchResult | null = skillBank && jdText.trim().length > 20
    ? matchSkillBankWithJD(skillBank, jdText)
    : null;

  return (
    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-xl transition-all shadow-xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 flex flex-wrap items-center gap-2">
              <span>GitHub Technical Skill Bank</span>
              {skillBank && (
                <span className="text-[11px] sm:text-xs bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-2.5 py-0.5 rounded-full font-medium">
                  {skillBank.skills.length} Skills Extracted from {skillBank.projects?.length || 0} Repos
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Scan repositories to extract granular skills, frameworks & versions mapped to specific projects.
            </p>
          </div>
        </div>

        {skillBank && (
          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">
            <label className="flex items-center gap-2 cursor-pointer bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all text-xs text-slate-300">
              <input
                type="checkbox"
                checked={useSkillBankInTailoring}
                onChange={(e) => setUseSkillBankInTailoring(e.target.checked)}
                className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
              />
              Inject Skill Bank into Resume
            </label>
            <button
              onClick={onClearBank}
              className="text-xs text-rose-400 hover:text-rose-300 underline transition-colors"
            >
              Reset Scan
            </button>
          </div>
        )}
      </div>

      {/* Input / Scanner Controls */}
      {!skillBank ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 border-b border-white/5 pb-3">
            <button
              onClick={() => setAuthMode("username")}
              className={`text-xs font-semibold px-3 py-2 rounded-lg transition-all text-center ${
                authMode === "username"
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Public Username Scan
            </button>
            <button
              onClick={() => setAuthMode("token")}
              className={`text-xs font-semibold px-3 py-2 rounded-lg transition-all text-center ${
                authMode === "token"
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Personal Access Token (Public & Private Repos)
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {authMode === "username" ? (
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter GitHub Username (e.g. octocat)..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
              />
            ) : (
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste GitHub Personal Access Token (ghp_...)..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
              />
            )}

            <button
              onClick={handleScan}
              disabled={isScanning || (authMode === "username" ? !username.trim() : !token.trim())}
              className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-medium text-sm px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 min-h-[44px]"
            >
              {isScanning ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Scanning Repositories...</span>
                </>
              ) : (
                <span>Build Skill Bank</span>
              )}
            </button>
          </div>

          {scanError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium">
              {scanError}
            </div>
          )}
        </div>
      ) : (
        /* Scanned Skill Bank View */
        <div className="space-y-5 sm:space-y-6">
          {/* Category & Projects Tabs */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {(["All", "Languages", "Frameworks", "Databases", "ToolsAndCloud"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition-all ${
                  activeCategory === cat
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                    : "bg-white/5 text-slate-400 hover:text-slate-200 border border-white/5"
                }`}
              >
                {cat === "ToolsAndCloud" ? "Tools & Cloud" : cat}
                <span className="ml-1 text-[10px] opacity-70">
                  ({cat === "All" ? skillBank.skills.length : skillBank.categorized[cat as keyof typeof skillBank.categorized]?.length || 0})
                </span>
              </button>
            ))}
            <button
              onClick={() => setActiveCategory("Projects")}
              className={`text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition-all ${
                activeCategory === "Projects"
                  ? "bg-purple-500/30 text-purple-300 border border-purple-500/50"
                  : "bg-white/5 text-slate-400 hover:text-slate-200 border border-white/5"
              }`}
            >
              📁 Scanned Projects ({skillBank.projects?.length || 0})
            </button>
          </div>

          {/* Skill Badges View */}
          {activeCategory !== "Projects" ? (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 max-h-52 overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
              {skillBank.skills
                .filter(s => activeCategory === "All" || s.category === activeCategory)
                .map((item, idx) => (
                  <div
                    key={idx}
                    title={`Project Source: ${item.sourceRepo} | ${item.evidence}`}
                    className="group relative bg-white/5 border border-white/10 hover:border-purple-500/40 px-2.5 sm:px-3 py-1.5 rounded-xl flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-200 transition-all hover:bg-purple-500/10 cursor-help"
                  >
                    <span className="font-medium">{item.name}</span>
                    {item.versionDetails && (
                      <span className="text-[9px] sm:text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                        {item.versionDetails}
                      </span>
                    )}
                    <span className="text-[9px] sm:text-[10px] text-purple-300/80 group-hover:text-purple-200 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 truncate max-w-[140px] sm:max-w-[200px]">
                      Project: {item.sourceRepo}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            /* Projects & Skill Mapping Cards */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
              {(skillBank.projects || []).map((proj, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={proj.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-indigo-300 hover:text-indigo-200 hover:underline flex items-center gap-1.5 truncate"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                        </svg>
                        <span className="truncate">{proj.name}</span>
                      </a>
                      <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10 shrink-0">
                        {proj.primaryLanguage}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{proj.description}</p>
                  </div>
                  {proj.extractedSkills && proj.extractedSkills.length > 0 && (
                    <div className="pt-2 border-t border-white/5">
                      <span className="text-[10px] text-purple-300/80 block mb-1 font-semibold">Extracted Skills:</span>
                      <div className="flex flex-wrap gap-1">
                        {proj.extractedSkills.map((sk, sIdx) => (
                          <span key={sIdx} className="text-[9px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-1.5 py-0.5 rounded">
                            {sk}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* JD Match Matrix (If JD is pasted) */}
          {matchResult && (
            <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-purple-500/5 border border-purple-500/15 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-purple-300">JD vs. Skill Bank Match Matrix</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">ATS Match Index:</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    matchResult.matchScore >= 75 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}>
                    {matchResult.matchScore}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {/* Matched Skills */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Matched Skills in GitHub Profile ({matchResult.matchedKeywords.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {matchResult.matchedKeywords.map((m, i) => (
                      <span key={i} className="text-[10px] sm:text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <span>{m.skill}</span>
                        {m.sourceRepo && (
                          <span className="text-[9px] opacity-70 bg-emerald-500/20 px-1 py-0.2 rounded truncate max-w-[100px]">
                            {m.sourceRepo}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Missing Gaps */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-rose-400 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Missing Gaps in Profile ({matchResult.missingGaps.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {matchResult.missingGaps.length > 0 ? (
                      matchResult.missingGaps.map((gap, i) => (
                        <span key={i} className="text-[10px] sm:text-[11px] bg-rose-500/10 border border-rose-500/20 text-rose-300 px-2 py-0.5 rounded-lg">
                          {gap}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 italic">No major skill gaps identified!</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Relevant Projects for Target JD */}
              {matchResult.relevantProjects && matchResult.relevantProjects.length > 0 && (
                <div className="pt-3 border-t border-purple-500/20 space-y-2">
                  <div className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
                    📁 Relevant GitHub Projects for Target JD ({matchResult.relevantProjects.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {matchResult.relevantProjects.map((p, pIdx) => (
                      <div key={pIdx} className="bg-white/5 border border-purple-500/20 rounded-lg p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-purple-200 gap-2">
                          <a href={p.repoUrl} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1 truncate">
                            <span className="truncate">{p.name}</span>
                          </a>
                          <span className="text-[9px] bg-purple-500/20 px-1.5 py-0.5 rounded text-purple-300 shrink-0">{p.primaryLanguage}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1">{p.description}</p>
                        {p.extractedSkills && p.extractedSkills.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {p.extractedSkills.slice(0, 6).map((sk, skIdx) => (
                              <span key={skIdx} className="text-[8px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/30">
                                {sk}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
