import React, { useState, useEffect } from "react";
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Download,
  Edit2,
  Trash2,
  RefreshCw,
  ArrowRight,
  Clipboard,
} from "lucide-react";
import {
  getResume,
  saveResume,
  getLastDetectedJD,
  saveLastDetectedJD,
  getTailoredResult,
  saveTailoredResult,
  clearAllStorage,
} from "../lib/storage";
import { parseResume, parseJD, tailorResume, exportPDF, exportDOCX } from "../lib/api-client";
import type { ResumeData, JDData, TailoredResult } from "../lib/types";

export default function SidePanel() {
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [rawResumeText, setRawResumeText] = useState("");
  const [jdInput, setJdInput] = useState("");
  const [jdData, setJdData] = useState<JDData | null>(null);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [isParsingJD, setIsParsingJD] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [tailoredResult, setTailoredResult] = useState<TailoredResult | null>(null);
  const [error, setError] = useState("");
  const [viewTab, setViewTab] = useState<"diff" | "full">("diff");
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Upload/Setup, Step 2: Tailor/Results
  const [activeEditIndex, setActiveEditIndex] = useState<{ section: string; idx: number; bulletIdx?: number } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Load saved state on mount
  useEffect(() => {
    async function loadData() {
      try {
        const savedResume = await getResume();
        const savedResult = await getTailoredResult();
        const savedJD = await getLastDetectedJD();

        if (savedResume) {
          setResume(savedResume);
          setStep(2); // Jump to tailoring step if resume exists
        }
        if (savedResult) {
          setTailoredResult(savedResult);
        }
        if (savedJD) {
          setJdInput(savedJD);
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
      // Step 1: Parse JD structure first
      setIsParsingJD(true);
      const parsedJD = await parseJD({ text: jdInput });
      setJdData(parsedJD);
      setIsParsingJD(false);

      // Step 2: Tailor resume to JD
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

  // Handler: Export PDF
  const handleDownloadPDF = async () => {
    const dataToExport = tailoredResult ? tailoredResult.tailoredResume : resume;
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
    const dataToExport = tailoredResult ? tailoredResult.tailoredResume : resume;
    if (!dataToExport) return;

    try {
      const blob = await exportDOCX(dataToExport);
      triggerDownload(
        blob,
        `${dataToExport.name.replace(/\s+/g, "_")}_Tailored.docx`
      );
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

  // Inline editing handler
  const saveInlineEdit = (section: string, idx: number, bulletIdx?: number) => {
    if (tailoredResult) {
      const updated = { ...tailoredResult };
      const resumeObj = updated.tailoredResume;

      if (section === "summary") {
        resumeObj.summary = editValue;
      } else if (section === "experience" && typeof bulletIdx === "number") {
        resumeObj.experience[idx].highlights[bulletIdx] = editValue;
      } else if (section === "experience" && bulletIdx === undefined) {
        resumeObj.experience[idx].role = editValue;
      } else if (section === "projects" && typeof bulletIdx === "number") {
        resumeObj.projects[idx].highlights[bulletIdx] = editValue;
      } else if (section === "projects" && bulletIdx === undefined) {
        resumeObj.projects[idx].name = editValue;
      }

      setTailoredResult(updated);
      saveTailoredResult(updated);
    } else if (resume) {
      const updatedResume = { ...resume };

      if (section === "summary") {
        updatedResume.summary = editValue;
      } else if (section === "experience" && typeof bulletIdx === "number") {
        updatedResume.experience[idx].highlights[bulletIdx] = editValue;
      } else if (section === "experience" && bulletIdx === undefined) {
        updatedResume.experience[idx].role = editValue;
      } else if (section === "projects" && typeof bulletIdx === "number") {
        updatedResume.projects[idx].highlights[bulletIdx] = editValue;
      } else if (section === "projects" && bulletIdx === undefined) {
        updatedResume.projects[idx].name = editValue;
      }

      setResume(updatedResume);
      saveResume(updatedResume);
    }
    setActiveEditIndex(null);
  };

  const startInlineEdit = (
    section: string,
    idx: number,
    value: string,
    bulletIdx?: number
  ) => {
    setActiveEditIndex({ section, idx, bulletIdx });
    setEditValue(value);
  };

  // Reset extension storage
  const handleReset = async () => {
    await clearAllStorage();
    setResume(null);
    setRawResumeText("");
    setJdInput("");
    setJdData(null);
    setTailoredResult(null);
    setStep(1);
    setError("");
  };

  const displayResume = tailoredResult ? tailoredResult.tailoredResume : resume;


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
        {resume && (
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-all duration-200"
            title="Reset Extension"
          >
            <Trash2 size={16} />
          </button>
        )}
      </header>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
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

          {/* AI TAILORED STATS & DOWNLOADS */}
          {tailoredResult && (
            <div className="flex flex-col gap-4 mt-2">
              {/* ATS SCORE RING & REASONING */}
              <div className="p-4 rounded-2xl bg-white/2 border border-white/5 flex items-center gap-4">
                {/* SVG Progress Ring */}
                <div className="relative h-16 w-16 shrink-0">
                  <svg className="h-full w-full transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      className="stroke-white/5 fill-none"
                      strokeWidth="5"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      className={`fill-none transition-all duration-1000 ${
                        tailoredResult.atsScore >= 70
                          ? "stroke-emerald-500"
                          : tailoredResult.atsScore >= 40
                          ? "stroke-amber-500"
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
                  <p className="text-[10px] text-slate-400 line-clamp-3">
                    {tailoredResult.scoreReasoning}
                  </p>
                </div>
              </div>

              {/* KEYWORD BADGES */}
              <div className="flex flex-col gap-3">
                {/* Matched Keywords */}
                {tailoredResult.matchedKeywords.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                      <CheckCircle size={10} className="text-emerald-400" />
                      Matched Keywords ({tailoredResult.matchedKeywords.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {tailoredResult.matchedKeywords.map((kw, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Keywords */}
                {tailoredResult.missingKeywords.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                      <AlertTriangle size={10} className="text-amber-400" />
                      Missing Gaps ({tailoredResult.missingKeywords.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {tailoredResult.missingKeywords.map((kw, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-medium"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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

          {/* UNIFIED RESUME PREVIEW & INLINE EDITOR */}
          {displayResume && (
            <div className="flex flex-col gap-4 mt-4 border-t border-white/5 pt-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  {tailoredResult ? "✨ Tailored Resume Preview" : "📄 Master Resume Preview"}
                </h3>
                {tailoredResult && (
                  <div className="flex border border-white/10 rounded-lg p-0.5 bg-black/30 text-[10px]">
                    <button
                      onClick={() => setViewTab("diff")}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        viewTab === "diff"
                          ? "bg-indigo-500 text-white font-medium shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Inline Editor
                    </button>
                    <button
                      onClick={() => setViewTab("full")}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        viewTab === "full"
                          ? "bg-indigo-500 text-white font-medium shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Full View
                    </button>
                  </div>
                )}
              </div>

              {/* RENDER ACTIVE TAB */}
              {(!tailoredResult || viewTab === "diff") ? (
                <div className="flex flex-col gap-4 text-xs">
                  {/* Summary Section */}
                  <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-slate-300">Professional Summary</h4>
                      <Edit2 size={12} className="text-slate-500" />
                    </div>
                    {activeEditIndex?.section === "summary" ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          rows={3}
                          className="w-full p-2 bg-black border border-white/10 rounded-lg text-xs focus:outline-none focus:border-indigo-500/50"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setActiveEditIndex(null)}
                            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveInlineEdit("summary", 0)}
                            className="px-2.5 py-1 rounded bg-indigo-500 hover:bg-indigo-600 text-[10px] text-white"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p
                        onClick={() =>
                          startInlineEdit("summary", 0, displayResume.summary)
                        }
                        className="text-slate-300 cursor-pointer hover:bg-white/2 p-1.5 rounded transition-colors border border-transparent hover:border-white/5"
                      >
                        {displayResume.summary || "Click to add a professional summary..."}
                      </p>
                    )}
                  </div>

                  {/* Experience Section */}
                  <div className="flex flex-col gap-3">
                    <h4 className="font-bold text-slate-400 px-1">Work Experience Highlights</h4>
                    {displayResume.experience?.map((job, jobIdx) => (
                      <div key={jobIdx} className="p-3 rounded-xl bg-white/2 border border-white/5 flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-semibold text-slate-200">
                              {job.role}
                            </h5>
                            <p className="text-[10px] text-indigo-300">{job.company}</p>
                          </div>
                          <span className="text-[10px] text-slate-500">{job.duration}</span>
                        </div>

                        <ul className="list-disc pl-4 flex flex-col gap-2 text-slate-300">
                          {job.highlights?.map((bullet, bulletIdx) => {
                            const isEditing =
                              activeEditIndex?.section === "experience" &&
                              activeEditIndex.idx === jobIdx &&
                              activeEditIndex.bulletIdx === bulletIdx;

                            return (
                              <li key={bulletIdx} className="hover:bg-white/1 flex gap-2 justify-between group rounded p-1">
                                {isEditing ? (
                                  <div className="flex flex-col gap-2 mt-1 w-full">
                                    <textarea
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      rows={2}
                                      className="w-full p-2 bg-black border border-white/10 rounded-lg text-xs focus:outline-none focus:border-indigo-500/50"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button
                                        onClick={() => setActiveEditIndex(null)}
                                        className="px-2.5 py-1 rounded bg-white/5 text-[10px]"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() =>
                                          saveInlineEdit("experience", jobIdx, bulletIdx)
                                        }
                                        className="px-2.5 py-1 rounded bg-indigo-500 text-[10px] text-white"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <span
                                      onClick={() =>
                                        startInlineEdit("experience", jobIdx, bullet, bulletIdx)
                                      }
                                      className="cursor-pointer flex-1"
                                    >
                                      {bullet}
                                    </span>
                                    <Edit2 size={10} className="text-slate-600 group-hover:text-indigo-400 shrink-0 self-start mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* FULL PREVIEW TAB */
                <div className="p-4 rounded-xl bg-white/2 border border-white/5 text-xs flex flex-col gap-4 max-h-[400px] overflow-y-auto">
                  <div className="text-center">
                    <h3 className="font-bold text-sm">{displayResume.name}</h3>
                    <p className="text-slate-400 text-[10px]">{displayResume.title}</p>
                  </div>

                  <div>
                    <h4 className="font-bold border-b border-white/5 pb-0.5 text-indigo-400 uppercase text-[10px]">
                      Summary
                    </h4>
                    <p className="mt-1 text-slate-300 leading-relaxed">
                      {displayResume.summary}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold border-b border-white/5 pb-0.5 text-indigo-400 uppercase text-[10px]">
                      Experience
                    </h4>
                    <div className="flex flex-col gap-3 mt-2">
                      {displayResume.experience?.map((exp, i) => (
                        <div key={i}>
                          <div className="flex justify-between font-semibold text-slate-200">
                            <span>
                              {exp.role} - {exp.company}
                            </span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              {exp.duration}
                            </span>
                          </div>
                          <ul className="list-disc pl-4 mt-1 text-slate-300 flex flex-col gap-1">
                            {exp.highlights?.map((h, j) => (
                              <li key={j}>{h}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold border-b border-white/5 pb-0.5 text-indigo-400 uppercase text-[10px]">
                      Skills
                    </h4>
                    <div className="flex flex-col gap-1 mt-1 text-slate-300">
                      {displayResume.skills?.languages?.length > 0 && (
                        <div>
                          <strong>Languages:</strong>{" "}
                          {displayResume.skills.languages.join(", ")}
                        </div>
                      )}
                      {displayResume.skills?.frameworks?.length > 0 && (
                        <div>
                          <strong>Frameworks:</strong>{" "}
                          {displayResume.skills.frameworks.join(", ")}
                        </div>
                      )}
                      {displayResume.skills?.tools?.length > 0 && (
                        <div>
                          <strong>Tools/Databases:</strong>{" "}
                          {displayResume.skills.tools.join(", ")}
                        </div>
                      )}
                    </div>
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
