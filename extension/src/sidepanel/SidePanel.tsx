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

  // Handler: Export PDF — sends original PDF to backend for modification
  const handleDownloadPDF = async () => {
    const dataToExport = buildFinalResume();
    if (!dataToExport) return;

    try {
      // Pass original PDF + changes so backend modifies the original PDF directly
      const blob = await exportPDF(
        dataToExport,
        originalPdf,
        tailoredResult?.changes
      );
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
    <div className="flex flex-col min-h-screen bg-white text-gray-900 p-4">
      {/* Header */}
      <header className="flex items-center justify-between pb-4 border-b border-gray-200 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="font-bold text-sm text-white">RT</span>
          </div>
          <span className="font-bold text-md tracking-tight text-gray-900">Resume Tailor</span>
        </div>
        <button
          onClick={handleReset}
          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-gray-100 transition-all duration-200"
          title="Reset App State"
        >
          <RefreshCw size={16} />
        </button>
      </header>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex flex-col gap-2">
          <div className="flex gap-2 items-start">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button 
            onClick={handleReset}
            className="w-full mt-1 py-1.5 bg-rose-100 hover:bg-rose-200 rounded text-rose-600 font-medium transition-colors"
          >
            Clear & Try Again
          </button>
        </div>
      )}

      {/* STEP 1: Upload Resume */}
      {step === 1 && (
        <div className="flex flex-col gap-5 flex-1">
          <div className="text-center py-4">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Upload Your Master Resume
            </h2>
            <p className="text-xs text-gray-500">
              PDF or DOCX. We parse details to match against JDs.
            </p>
          </div>

          {/* File Dropzone */}
          <div className="relative group">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl p-8 hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer transition-all duration-300 text-center">
              <Upload size={32} className="text-indigo-500 mb-3 group-hover:scale-110 transition-transform duration-300" />
              <span className="text-xs font-semibold mb-1 text-gray-700">
                Drag & Drop or Click to Upload
              </span>
              <span className="text-[10px] text-gray-400">PDF, DOCX (Max 5MB)</span>
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleResumeUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isParsingResume}
              />
            </label>
            {isParsingResume && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-3">
                <RefreshCw size={24} className="text-indigo-500 animate-spin" />
                <span className="text-xs text-indigo-600 font-medium">Parsing resume data...</span>
              </div>
            )}
          </div>

          <div className="flex items-center my-2 text-gray-400 text-xs">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="px-3">OR PASTE TEXT</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Text Area Input */}
          <div className="flex flex-col gap-3">
            <textarea
              placeholder="Paste your plain text resume content here..."
              value={rawResumeText}
              onChange={(e) => setRawResumeText(e.target.value)}
              rows={8}
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none placeholder:text-gray-400 text-gray-800"
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
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-indigo-500" />
              <div>
                <h4 className="text-xs font-semibold leading-tight text-gray-900">{resume.name}</h4>
                <p className="text-[10px] text-gray-500">{resume.title || "Resume Uploaded"}</p>
              </div>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-[10px] text-indigo-500 hover:underline"
            >
              Change
            </button>
          </div>

          {/* JD Input Panel */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700">Job Description (JD)</label>
              <button
                onClick={handlePasteClipboard}
                className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-600 hover:underline"
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
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none placeholder:text-gray-400 text-gray-800"
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
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0">
                  <svg className="h-full w-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" className="stroke-gray-200 fill-none" strokeWidth="5" />
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
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-sm text-gray-900">
                    {tailoredResult.atsScore}%
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold mb-1 text-gray-900">ATS Compatibility Score</h3>
                  <p className="text-[10px] text-gray-500 line-clamp-3">{tailoredResult.scoreReasoning}</p>
                </div>
              </div>

              {/* KEYWORD BADGES */}
              <div className="flex flex-col gap-3">
                {tailoredResult.matchedKeywords.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1 flex items-center gap-1">
                      <CheckCircle size={10} className="text-emerald-500" />
                      Matched Keywords ({tailoredResult.matchedKeywords.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {tailoredResult.matchedKeywords.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-medium border border-emerald-200">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {tailoredResult.missingKeywords.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1 flex items-center gap-1">
                      <AlertTriangle size={10} className="text-amber-500" />
                      Missing Gaps ({tailoredResult.missingKeywords.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {tailoredResult.missingKeywords.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-medium border border-amber-200">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CHANGE REVIEW BAR */}
              {changeStats && changeStats.total > 0 && (
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-amber-500" />
                      {changeStats.total} AI Changes to Review
                    </h4>
                    <div className="flex gap-1.5">
                      <button
                        onClick={approveAll}
                        className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-medium hover:bg-emerald-100 transition-colors border border-emerald-200"
                      >
                        ✅ Approve All
                      </button>
                      <button
                        onClick={rejectAll}
                        className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 text-[10px] font-medium hover:bg-rose-100 transition-colors border border-rose-200"
                      >
                        ❌ Reject All
                      </button>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-gray-200">
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
                        className="bg-amber-400 rounded-full transition-all duration-300"
                        style={{ width: `${(changeStats.pending / changeStats.total) * 100}%` }}
                      />
                    )}
                  </div>
                  <div className="flex gap-3 mt-1.5 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{changeStats.approved} approved</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />{changeStats.rejected} rejected</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{changeStats.pending} pending</span>
                  </div>
                </div>
              )}

              {/* DOWNLOAD BUTTONS */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={handleDownloadPDF}
                  className="py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 font-semibold text-xs text-gray-800 hover:bg-gray-100 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={14} />
                  Download PDF
                </button>
                <button
                  onClick={handleDownloadDOCX}
                  className="py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 font-semibold text-xs text-gray-800 hover:bg-gray-100 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={14} />
                  Download DOCX
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════ FULL RESUME DOCUMENT VIEW ═══════════════ */}
          {displayResume && (
            <div className="flex flex-col gap-0 mt-4 border-t border-gray-200 pt-4">
              <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Eye size={12} />
                {tailoredResult ? "Tailored Resume — Review Changes" : "Master Resume Preview"}
              </h3>

              {/* Resume Document Container — Always show original PDF if available */}
              {originalPdf ? (
                <div className="bg-white rounded-lg shadow-md border border-gray-200 w-full h-[600px] overflow-hidden">
                  <iframe 
                    src={originalPdf} 
                    className="w-full h-full border-none"
                    title="Resume Preview"
                  />
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-5 text-[#111827] text-[11px] leading-relaxed max-h-[600px] overflow-y-auto">

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
    ? "bg-amber-50 border-l-2 border-amber-400 pl-1.5 pr-1"
    : isApproved
    ? "bg-emerald-50 border-l-2 border-emerald-500 pl-1.5 pr-1"
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
          <span className="inline-flex ml-1 px-1 py-0 rounded text-[8px] font-bold bg-amber-100 text-amber-600 align-middle border border-amber-200">
            AI ✨
          </span>
        )}
        {isApproved && (
          <span className="inline-flex ml-1 px-1 py-0 rounded text-[8px] font-bold bg-emerald-100 text-emerald-600 align-middle border border-emerald-200">
            ✓
          </span>
        )}
        {isRejected && (
          <span className="inline-flex ml-1 px-1 py-0 rounded text-[8px] font-bold bg-rose-100 text-rose-500 align-middle border border-rose-200">
            ✗
          </span>
        )}
      </Tag>

      {/* Expanded change detail panel */}
      {isExpanded && (
        <div className="mt-1.5 p-2 rounded-lg bg-gray-50 border border-gray-200 text-[10px] shadow-md">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-gray-700 text-[10px]">{change.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setExpandedChangeId(null); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={10} />
            </button>
          </div>

          {/* Original vs New comparison */}
          <div className="space-y-1.5">
            <div className="p-1.5 rounded bg-rose-50 border border-rose-200">
              <span className="text-[8px] font-bold text-rose-500 uppercase block mb-0.5">Original</span>
              <span className="text-gray-700 leading-relaxed">{change.originalValue}</span>
            </div>
            <div className="p-1.5 rounded bg-emerald-50 border border-emerald-200">
              <span className="text-[8px] font-bold text-emerald-500 uppercase block mb-0.5">AI Suggested</span>
              <span className="text-gray-700 leading-relaxed">{change.newValue}</span>
            </div>
          </div>

          {/* Approve / Reject buttons */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={(e) => { e.stopPropagation(); onApprove(change.id); setExpandedChangeId(null); }}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
                isApproved
                  ? "bg-emerald-500 text-white"
                  : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200"
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
                  : "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"
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
