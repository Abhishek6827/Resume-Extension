import React, { useState, useEffect } from "react";
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Download,
  Trash2,
  RefreshCw,
  Clipboard,
  Check,
  X,
  CheckCheck,
  XCircle,
  Eye,
} from "lucide-react";
import {
  getResume,
  saveResume,
  getLastDetectedJD,
  saveLastDetectedJD,
  getTailoredResult,
  saveTailoredResult,
  clearAllStorage,
  saveOriginalPDF,
  getOriginalPDF,
} from "../lib/storage";
import { parseResume, parseJD, tailorResume, exportPDF, exportDOCX, applyApprovedChanges } from "../lib/api-client";
import type { ResumeData, JDData, TailoredResult, TailoredChange } from "../lib/types";

export default function SidePanel() {
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [originalPdf, setOriginalPdf] = useState<string | null>(null);
  const [rawResumeText, setRawResumeText] = useState("");
  const [jdInput, setJdInput] = useState("");
  const [jdData, setJdData] = useState<JDData | null>(null);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [isParsingJD, setIsParsingJD] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [tailoredResult, setTailoredResult] = useState<TailoredResult | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [expandedChangeId, setExpandedChangeId] = useState<string | null>(null);

  // Load saved state on mount
  useEffect(() => {
    async function loadData() {
      try {
        const savedResume = await getResume();
        const savedResult = await getTailoredResult();
        const savedJD = await getLastDetectedJD();
        const savedPdf = await getOriginalPDF();

        if (savedResume) {
          setResume(savedResume);
          setStep(2);
        }
        if (savedResult) {
          setTailoredResult(savedResult);
        }
        if (savedJD) {
          setJdInput(savedJD);
        }
        if (savedPdf) {
          setOriginalPdf(savedPdf);
        }
      } catch (err) {
        console.error("Error loading saved data:", err);
      }
    }
    loadData();
  }, []);

  // Listen for background JD updates
  useEffect(() => {
    function handleMessage(message: any) {
      if (message.type === "JD_DETECTED" || message.type === "JD_SELECTED") {
        const text = message.data.text || "";
        setJdInput(text);
        setError("");
      }
    }
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }
  }, []);

  // Handler: Parse Resume File
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          const base64 = event.target.result as string;
          setOriginalPdf(base64);
          await saveOriginalPDF(base64);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setOriginalPdf(null);
      await saveOriginalPDF("");
    }

    setIsParsingResume(true);
    setError("");

    try {
      const parsed = await parseResume({ file });
      setResume(parsed);
      await saveResume(parsed);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Failed to parse resume file.");
    } finally {
      setIsParsingResume(false);
    }
  };

  // Handler: Parse Resume Text
  const handleResumeTextSubmit = async () => {
    if (!rawResumeText.trim()) return;

    setIsParsingResume(true);
    setError("");

    try {
      const parsed = await parseResume({ text: rawResumeText });
      setResume(parsed);
      await saveResume(parsed);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Failed to parse resume text.");
    } finally {
      setIsParsingResume(false);
    }
  };

  // Handler: Paste from clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setJdInput(text);
        await saveLastDetectedJD(text);
      }
    } catch (err) {
      setError("Clipboard access denied. Please paste manually.");
    }
  };

  // Handler: Tailor Resume
  const handleTailor = async () => {
    if (!resume || !jdInput.trim()) return;

    setIsTailoring(true);
    setError("");
    setTailoredResult(null);

    try {
      setIsParsingJD(true);
      const parsedJD = await parseJD({ text: jdInput });
      setJdData(parsedJD);
      setIsParsingJD(false);

      const tailored = await tailorResume(resume, parsedJD);
      setTailoredResult(tailored);
      await saveTailoredResult(tailored);
    } catch (err: any) {
      setError(err.message || "Failed to tailor resume. Please check your API keys or backend connectivity.");
    } finally {
      setIsTailoring(false);
      setIsParsingJD(false);
    }
  };

  // Build the final resume data based on approved changes
  const buildFinalResume = (): ResumeData | null => {
    if (!resume) return null;
    if (!tailoredResult) return resume;
    return applyApprovedChanges(resume, tailoredResult.changes, tailoredResult.tailoredResume);
  };

  // Handler: Export PDF
  const handleDownloadPDF = async () => {
    const dataToExport = buildFinalResume();
    if (!dataToExport) return;

    try {
      const blob = await exportPDF(dataToExport);
      triggerDownload(blob, `${dataToExport.name.replace(/\s+/g, "_")}_Tailored.pdf`);
    } catch (err: any) {
      setError("PDF generation failed. Check backend server logs.");
    }
  };

  // Handler: Export DOCX
  const handleDownloadDOCX = async () => {
    const dataToExport = buildFinalResume();
    if (!dataToExport) return;

    try {
      const blob = await exportDOCX(dataToExport);
      triggerDownload(blob, `${dataToExport.name.replace(/\s+/g, "_")}_Tailored.docx`);
    } catch (err: any) {
      setError("DOCX generation failed. Check backend server logs.");
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  // Change approval handlers
  const updateChangeStatus = (changeId: string, status: "approved" | "rejected") => {
    if (!tailoredResult) return;
    const updated = {
      ...tailoredResult,
      changes: tailoredResult.changes.map((c) =>
        c.id === changeId ? { ...c, status } : c
      ),
    };
    setTailoredResult(updated);
    saveTailoredResult(updated);
  };

  const approveAll = () => {
    if (!tailoredResult) return;
    const updated = {
      ...tailoredResult,
      changes: tailoredResult.changes.map((c) => ({ ...c, status: "approved" as const })),
    };
    setTailoredResult(updated);
    saveTailoredResult(updated);
  };

  const rejectAll = () => {
    if (!tailoredResult) return;
    const updated = {
      ...tailoredResult,
      changes: tailoredResult.changes.map((c) => ({ ...c, status: "rejected" as const })),
    };
    setTailoredResult(updated);
    saveTailoredResult(updated);
  };

  // Reset extension storage
  const handleReset = async () => {
    await clearAllStorage();
    setResume(null);
    setOriginalPdf(null);
    setRawResumeText("");
    setJdInput("");
    setJdData(null);
    setTailoredResult(null);
    setStep(1);
    setError("");
  };

  // Compute change stats
  const changeStats = tailoredResult
    ? {
        total: tailoredResult.changes.length,
        approved: tailoredResult.changes.filter((c) => c.status === "approved").length,
        rejected: tailoredResult.changes.filter((c) => c.status === "rejected").length,
        pending: tailoredResult.changes.filter((c) => c.status === "pending").length,
      }
    : null;

  // Helper: get value for a field in the resume preview (resolves which text to show based on change status)
  const getResolvedValue = (field: string, originalValue: string): { text: string; isChanged: boolean; change: TailoredChange | null } => {
    if (!tailoredResult) return { text: originalValue, isChanged: false, change: null };
    const change = tailoredResult.changes.find((c) => c.field === field);
    if (!change) return { text: originalValue, isChanged: false, change: null };

    if (change.status === "approved") {
      return { text: change.newValue, isChanged: true, change };
    } else if (change.status === "rejected") {
      return { text: originalValue, isChanged: false, change };
    }
    // pending — show AI suggestion with highlight
    return { text: change.newValue, isChanged: true, change };
  };

  // Build the display resume from resolved values
  const displayResume = resume;


  return (
    <div className="flex flex-col min-h-screen bg-[#090a0f] text-slate-100 p-4">
      {/* Header */}
      <header className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="font-bold text-sm text-white">RT</span>
          </div>
          <span className="font-bold text-md tracking-tight">Resume Tailor</span>
        </div>
        <button
          onClick={handleReset}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-all duration-200"
          title="Reset App State"
        >
          <RefreshCw size={16} />
        </button>
      </header>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex flex-col gap-2">
          <div className="flex gap-2 items-start">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button 
            onClick={handleReset}
            className="w-full mt-1 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 rounded text-rose-300 font-medium transition-colors"
          >
            Clear & Try Again
          </button>
        </div>
      )}

      {/* STEP 1: Upload Resume */}
      {step === 1 && (
        <div className="flex flex-col gap-5 flex-1">
          <div className="text-center py-4">
            <h2 className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent mb-1">
              Upload Your Master Resume
            </h2>
            <p className="text-xs text-slate-400">
              PDF or DOCX. We parse details to match against JDs.
            </p>
          </div>

          {/* File Dropzone */}
          <div className="relative group">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-8 hover:border-indigo-500/30 hover:bg-white/2 cursor-pointer transition-all duration-300 text-center">
              <Upload size={32} className="text-indigo-400 mb-3 group-hover:scale-110 transition-transform duration-300" />
              <span className="text-xs font-semibold mb-1 text-slate-200">
                Drag & Drop or Click to Upload
              </span>
              <span className="text-[10px] text-slate-500">PDF, DOCX (Max 5MB)</span>
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleResumeUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isParsingResume}
              />
            </label>
            {isParsingResume && (
              <div className="absolute inset-0 bg-[#090a0f]/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-3">
                <RefreshCw size={24} className="text-indigo-400 animate-spin" />
                <span className="text-xs text-indigo-300 font-medium">Parsing resume data...</span>
              </div>
            )}
          </div>

          <div className="flex items-center my-2 text-slate-600 text-xs">
            <div className="flex-1 h-px bg-white/5"></div>
            <span className="px-3">OR PASTE TEXT</span>
            <div className="flex-1 h-px bg-white/5"></div>
          </div>

          {/* Text Area Input */}
          <div className="flex flex-col gap-3">
            <textarea
              placeholder="Paste your plain text resume content here..."
              value={rawResumeText}
              onChange={(e) => setRawResumeText(e.target.value)}
              rows={8}
              className="w-full text-xs bg-white/3 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-indigo-500/50 resize-none placeholder:text-slate-600"
            />
            <button
              onClick={handleResumeTextSubmit}
              disabled={isParsingResume || !rawResumeText.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 font-semibold text-xs text-white shadow-lg shadow-indigo-500/20 hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              Parse Resume Text
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Tailoring Interface */}
      {step === 2 && resume && (
        <div className="flex flex-col gap-4 flex-1">
          {/* Resume Uploaded Status Card */}
          <div className="p-3 rounded-xl bg-white/2 border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-indigo-400" />
              <div>
                <h4 className="text-xs font-semibold leading-tight">{resume.name}</h4>
                <p className="text-[10px] text-slate-500">{resume.title || "Resume Uploaded"}</p>
              </div>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-[10px] text-indigo-400 hover:underline"
            >
              Change
            </button>
          </div>

          {/* JD Input Panel */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">Job Description (JD)</label>
              <button
                onClick={handlePasteClipboard}
                className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline"
              >
                <Clipboard size={10} />
                Paste Clipboard
              </button>
            </div>

            <textarea
              placeholder="Auto-detecting job description... Or paste a JD here manually."
              value={jdInput}
              onChange={(e) => setJdInput(e.target.value)}
              rows={5}
              className="w-full text-xs bg-white/3 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-indigo-500/50 resize-none placeholder:text-slate-600"
            />

            <button
              onClick={handleTailor}
              disabled={isTailoring || !jdInput.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 font-semibold text-xs text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 hover:opacity-95 transition-all duration-300 disabled:opacity-50"
            >
              {isTailoring ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  {isParsingJD ? "Structuring Job Description..." : "AI Customizing Resume..."}
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Tailor My Resume
                </>
              )}
            </button>
          </div>

          {/* AI TAILORED STATS */}
          {tailoredResult && (
            <div className="flex flex-col gap-4 mt-2">
              {/* ATS SCORE RING & REASONING */}
              <div className="p-4 rounded-2xl bg-white/2 border border-white/5 flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0">
                  <svg className="h-full w-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" className="stroke-white/5 fill-none" strokeWidth="5" />
                    <circle
                      cx="32" cy="32" r="28"
                      className={`fill-none transition-all duration-1000 ${
                        tailoredResult.atsScore >= 70 ? "stroke-emerald-500"
                        : tailoredResult.atsScore >= 40 ? "stroke-amber-500"
                        : "stroke-rose-500"
                      }`}
                      strokeWidth="5"
                      strokeDasharray="175"
                      strokeDashoffset={175 - (175 * tailoredResult.atsScore) / 100}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-sm">
                    {tailoredResult.atsScore}%
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold mb-1">ATS Compatibility Score</h3>
                  <p className="text-[10px] text-slate-400 line-clamp-3">{tailoredResult.scoreReasoning}</p>
                </div>
              </div>

              {/* KEYWORD BADGES */}
              <div className="flex flex-col gap-3">
                {tailoredResult.matchedKeywords.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                      <CheckCircle size={10} className="text-emerald-400" />
                      Matched Keywords ({tailoredResult.matchedKeywords.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {tailoredResult.matchedKeywords.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {tailoredResult.missingKeywords.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                      <AlertTriangle size={10} className="text-amber-400" />
                      Missing Gaps ({tailoredResult.missingKeywords.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {tailoredResult.missingKeywords.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-medium">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CHANGE REVIEW BAR */}
              {changeStats && changeStats.total > 0 && (
                <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-amber-400" />
                      {changeStats.total} AI Changes to Review
                    </h4>
                    <div className="flex gap-1.5">
                      <button
                        onClick={approveAll}
                        className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-medium hover:bg-emerald-500/20 transition-colors"
                      >
                        ✅ Approve All
                      </button>
                      <button
                        onClick={rejectAll}
                        className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 text-[10px] font-medium hover:bg-rose-500/20 transition-colors"
                      >
                        ❌ Reject All
                      </button>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-white/5">
                    {changeStats.approved > 0 && (
                      <div
                        className="bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${(changeStats.approved / changeStats.total) * 100}%` }}
                      />
                    )}
                    {changeStats.rejected > 0 && (
                      <div
                        className="bg-rose-500 rounded-full transition-all duration-300"
                        style={{ width: `${(changeStats.rejected / changeStats.total) * 100}%` }}
                      />
                    )}
                    {changeStats.pending > 0 && (
                      <div
                        className="bg-amber-500/50 rounded-full transition-all duration-300"
                        style={{ width: `${(changeStats.pending / changeStats.total) * 100}%` }}
                      />
                    )}
                  </div>
                  <div className="flex gap-3 mt-1.5 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{changeStats.approved} approved</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />{changeStats.rejected} rejected</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500/50" />{changeStats.pending} pending</span>
                  </div>
                </div>
              )}

              {/* DOWNLOAD BUTTONS */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={handleDownloadPDF}
                  className="py-3 px-4 rounded-xl bg-white/5 border border-white/10 font-semibold text-xs text-white hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={14} />
                  Download PDF
                </button>
                <button
                  onClick={handleDownloadDOCX}
                  className="py-3 px-4 rounded-xl bg-white/5 border border-white/10 font-semibold text-xs text-white hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={14} />
                  Download DOCX
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════ FULL RESUME DOCUMENT VIEW ═══════════════ */}
          {displayResume && (
            <div className="flex flex-col gap-0 mt-4 border-t border-white/5 pt-4">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Eye size={12} />
                {tailoredResult ? "Tailored Resume — Review Changes" : "Master Resume Preview"}
              </h3>

              {/* Resume Document Container */}
              {(!tailoredResult && originalPdf) ? (
                <div className="bg-white rounded-lg shadow-xl shadow-black/30 w-full h-[600px] overflow-hidden">
                  <iframe 
                    src={originalPdf} 
                    className="w-full h-full border-none"
                    title="Original Resume Preview"
                  />
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-xl shadow-black/30 p-5 text-[#111827] text-[11px] leading-relaxed max-h-[600px] overflow-y-auto">

                  {/* ─── Header: Name & Contact ─── */}
                <div className="text-center mb-3">
                  <h1 className="text-base font-bold text-[#111827] mb-0.5">{displayResume.name}</h1>
                  <ResumeField
                    field="title"
                    originalValue={displayResume.title || ""}
                    getResolvedValue={getResolvedValue}
                    onApprove={(id) => updateChangeStatus(id, "approved")}
                    onReject={(id) => updateChangeStatus(id, "rejected")}
                    expandedChangeId={expandedChangeId}
                    setExpandedChangeId={setExpandedChangeId}
                    className="text-xs font-bold text-[#1e40af] uppercase"
                    as="p"
                  />
                  {/* Contact Line */}
                  <div className="text-[9px] text-[#4b5563] mt-1">
                    {[
                      displayResume.contact?.email,
                      displayResume.contact?.phone,
                      displayResume.contact?.location,
                      displayResume.contact?.linkedin,
                      displayResume.contact?.github,
                      displayResume.contact?.website,
                    ].filter(Boolean).join("  |  ")}
                  </div>
                </div>

                {/* ─── Summary ─── */}
                {(displayResume.summary || tailoredResult?.changes.some(c => c.field === "summary")) && (
                  <ResumeSection title="Summary">
                    <ResumeField
                      field="summary"
                      originalValue={displayResume.summary || ""}
                      getResolvedValue={getResolvedValue}
                      onApprove={(id) => updateChangeStatus(id, "approved")}
                      onReject={(id) => updateChangeStatus(id, "rejected")}
                      expandedChangeId={expandedChangeId}
                      setExpandedChangeId={setExpandedChangeId}
                      className="text-[#111827]"
                      as="p"
                    />
                  </ResumeSection>
                )}

                {/* ─── Experience ─── */}
                {displayResume.experience && displayResume.experience.length > 0 && (
                  <ResumeSection title="Experience">
                    {displayResume.experience.map((job, i) => (
                      <div key={i} className="mb-2">
                        <div className="flex justify-between items-baseline">
                          <span className="font-bold text-[11px] text-[#111827]">
                            {job.role} — {job.company}
                            {job.location ? <span className="font-normal text-[#4b5563] italic text-[10px]"> ({job.location})</span> : null}
                          </span>
                          <span className="text-[9px] text-[#4b5563] shrink-0 ml-2">{job.duration}</span>
                        </div>
                        {job.highlights && job.highlights.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {job.highlights.map((bullet, j) => (
                              <li key={j} className="flex gap-1">
                                <span className="shrink-0 text-[#4b5563]">•</span>
                                <ResumeField
                                  field={`experience[${i}].highlights[${j}]`}
                                  originalValue={bullet}
                                  getResolvedValue={getResolvedValue}
                                  onApprove={(id) => updateChangeStatus(id, "approved")}
                                  onReject={(id) => updateChangeStatus(id, "rejected")}
                                  expandedChangeId={expandedChangeId}
                                  setExpandedChangeId={setExpandedChangeId}
                                  className="text-[#111827]"
                                  as="span"
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </ResumeSection>
                )}

                {/* ─── Projects ─── */}
                {displayResume.projects && displayResume.projects.length > 0 && (
                  <ResumeSection title="Projects">
                    {displayResume.projects.map((proj, i) => (
                      <div key={i} className="mb-2">
                        <div className="flex items-baseline gap-1">
                          <span className="font-bold text-[11px] text-[#111827]">{proj.name}</span>
                          {proj.tech && proj.tech.length > 0 && (
                            <span className="text-[9px] text-[#4b5563]">[{proj.tech.join(", ")}]</span>
                          )}
                        </div>
                        <ResumeField
                          field={`projects[${i}].description`}
                          originalValue={proj.description || ""}
                          getResolvedValue={getResolvedValue}
                          onApprove={(id) => updateChangeStatus(id, "approved")}
                          onReject={(id) => updateChangeStatus(id, "rejected")}
                          expandedChangeId={expandedChangeId}
                          setExpandedChangeId={setExpandedChangeId}
                          className="text-[#111827]"
                          as="p"
                        />
                        {proj.highlights && proj.highlights.length > 0 && (
                          <ul className="mt-0.5 space-y-0.5">
                            {proj.highlights.map((bullet, j) => (
                              <li key={j} className="flex gap-1">
                                <span className="shrink-0 text-[#4b5563]">•</span>
                                <ResumeField
                                  field={`projects[${i}].highlights[${j}]`}
                                  originalValue={bullet}
                                  getResolvedValue={getResolvedValue}
                                  onApprove={(id) => updateChangeStatus(id, "approved")}
                                  onReject={(id) => updateChangeStatus(id, "rejected")}
                                  expandedChangeId={expandedChangeId}
                                  setExpandedChangeId={setExpandedChangeId}
                                  className="text-[#111827]"
                                  as="span"
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </ResumeSection>
                )}

                {/* ─── Skills ─── */}
                {displayResume.skills && (
                  <ResumeSection title="Skills">
                    {([
                      { key: "languages" as const, label: "Languages" },
                      { key: "frameworks" as const, label: "Frameworks/Libraries" },
                      { key: "tools" as const, label: "Tools/Databases" },
                      { key: "other" as const, label: "Other" },
                    ] as const).map((cat) => {
                      const values = displayResume.skills?.[cat.key];
                      if (!values || values.length === 0) return null;
                      return (
                        <div key={cat.key} className="mb-0.5">
                          <span className="font-bold text-[#111827]">{cat.label}: </span>
                          <ResumeField
                            field={`skills.${cat.key}`}
                            originalValue={values.join(", ")}
                            getResolvedValue={getResolvedValue}
                            onApprove={(id) => updateChangeStatus(id, "approved")}
                            onReject={(id) => updateChangeStatus(id, "rejected")}
                            expandedChangeId={expandedChangeId}
                            setExpandedChangeId={setExpandedChangeId}
                            className="text-[#111827]"
                            as="span"
                          />
                        </div>
                      );
                    })}
                  </ResumeSection>
                )}

                {/* ─── Education ─── */}
                {displayResume.education && displayResume.education.length > 0 && (
                  <ResumeSection title="Education">
                    {displayResume.education.map((edu, i) => (
                      <div key={i} className="flex justify-between items-baseline mb-1">
                        <span>
                          <span className="font-bold text-[#111827]">{edu.degree}</span>
                          <span className="text-[#4b5563]"> — {edu.institution}</span>
                          {edu.gpa && <span className="text-[#4b5563]"> (GPA: {edu.gpa})</span>}
                        </span>
                        <span className="text-[9px] text-[#4b5563] shrink-0 ml-2">{edu.year}</span>
                      </div>
                    ))}
                  </ResumeSection>
                )}

                {/* ─── Certifications ─── */}
                {displayResume.certifications && displayResume.certifications.length > 0 && (
                  <ResumeSection title="Certifications">
                    {displayResume.certifications.map((cert, i) => (
                      <div key={i} className="text-[#111827]">• {cert}</div>
                    ))}
                  </ResumeSection>
                )}

                {/* ─── Achievements ─── */}
                {displayResume.achievements && displayResume.achievements.length > 0 && (
                  <ResumeSection title="Achievements">
                    {displayResume.achievements.map((ach, i) => (
                      <div key={i} className="text-[#111827]">• {ach}</div>
                    ))}
                  </ResumeSection>
                )}
              </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   Sub-components for the resume document view
   ═══════════════════════════════════════════════════════════ */

/** Section header with underline */
function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <h2 className="text-[11px] font-bold text-[#1e40af] uppercase tracking-wide border-b border-[#e5e7eb] pb-0.5 mb-1.5">
        {title}
      </h2>
      {children}
    </div>
  );
}

/**
 * ResumeField — renders text with optional change highlighting.
 * If the field has an AI change, it shows a highlighted background with approve/reject controls.
 */
function ResumeField({
  field,
  originalValue,
  getResolvedValue,
  onApprove,
  onReject,
  expandedChangeId,
  setExpandedChangeId,
  className = "",
  as: Tag = "span",
}: {
  field: string;
  originalValue: string;
  getResolvedValue: (field: string, originalValue: string) => { text: string; isChanged: boolean; change: TailoredChange | null };
  onApprove: (changeId: string) => void;
  onReject: (changeId: string) => void;
  expandedChangeId: string | null;
  setExpandedChangeId: (id: string | null) => void;
  className?: string;
  as?: "span" | "p" | "div";
}) {
  const { text, isChanged, change } = getResolvedValue(field, originalValue);

  if (!change) {
    // No AI change — render plain text
    return <Tag className={className}>{text || originalValue}</Tag>;
  }

  const isExpanded = expandedChangeId === change.id;
  const isPending = change.status === "pending";
  const isApproved = change.status === "approved";
  const isRejected = change.status === "rejected";

  // Determine display text based on status
  const displayText = isRejected ? change.originalValue : change.newValue;

  // Style classes for different states
  const highlightClass = isPending
    ? "bg-amber-400/15 border-l-2 border-amber-400 pl-1.5 pr-1"
    : isApproved
    ? "bg-emerald-400/10 border-l-2 border-emerald-500 pl-1.5 pr-1"
    : "pl-1.5 pr-1 opacity-70";

  return (
    <div className="relative group/field">
      <Tag
        className={`${className} ${highlightClass} rounded-sm py-0.5 cursor-pointer transition-all duration-200 inline`}
        onClick={() => setExpandedChangeId(isExpanded ? null : change.id)}
      >
        {displayText}
        {/* Status indicator badge */}
        {isPending && (
          <span className="inline-flex ml-1 px-1 py-0 rounded text-[8px] font-bold bg-amber-500/20 text-amber-500 align-middle">
            AI ✨
          </span>
        )}
        {isApproved && (
          <span className="inline-flex ml-1 px-1 py-0 rounded text-[8px] font-bold bg-emerald-500/20 text-emerald-500 align-middle">
            ✓
          </span>
        )}
        {isRejected && (
          <span className="inline-flex ml-1 px-1 py-0 rounded text-[8px] font-bold bg-rose-500/20 text-rose-400 align-middle">
            ✗
          </span>
        )}
      </Tag>

      {/* Expanded change detail panel */}
      {isExpanded && (
        <div className="mt-1.5 p-2 rounded-lg bg-[#1a1b23] border border-white/10 text-[10px] shadow-lg">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-slate-300 text-[10px]">{change.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setExpandedChangeId(null); }}
              className="text-slate-500 hover:text-slate-300"
            >
              <X size={10} />
            </button>
          </div>

          {/* Original vs New comparison */}
          <div className="space-y-1.5">
            <div className="p-1.5 rounded bg-rose-500/5 border border-rose-500/10">
              <span className="text-[8px] font-bold text-rose-400 uppercase block mb-0.5">Original</span>
              <span className="text-slate-300 leading-relaxed">{change.originalValue}</span>
            </div>
            <div className="p-1.5 rounded bg-emerald-500/5 border border-emerald-500/10">
              <span className="text-[8px] font-bold text-emerald-400 uppercase block mb-0.5">AI Suggested</span>
              <span className="text-slate-300 leading-relaxed">{change.newValue}</span>
            </div>
          </div>

          {/* Approve / Reject buttons */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={(e) => { e.stopPropagation(); onApprove(change.id); setExpandedChangeId(null); }}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
                isApproved
                  ? "bg-emerald-500 text-white"
                  : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              }`}
            >
              <Check size={10} />
              Approve
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReject(change.id); setExpandedChangeId(null); }}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
                isRejected
                  ? "bg-rose-500 text-white"
                  : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
              }`}
            >
              <X size={10} />
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
