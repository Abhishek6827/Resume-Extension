import { useState, useEffect, useMemo } from "react";
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  Clipboard,
  Eye,
  XCircle,
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
import { parseResume, parseJD, scoreResume, tailorSection, exportPDF, exportDOCX, applyApprovedChanges } from "../lib/api-client";
import type { ResumeData, TailoredResult, TailoredChange, SkillsData } from "../lib/types";

export default function SidePanel() {
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [originalPdf, setOriginalPdf] = useState<string | null>(null);
  const [rawResumeText, setRawResumeText] = useState("");
  const [jdInput, setJdInput] = useState("");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [isParsingJD, setIsParsingJD] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [tailoredResult, setTailoredResult] = useState<TailoredResult | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [lastTailoredJd, setLastTailoredJd] = useState<string>("");

  // Detect if running inside an iframe (in-page modal popup)
  const isInsideIframe = window.self !== window.top;

  useEffect(() => {
    if (originalPdf) setPreviewPdfUrl(originalPdf);
  }, [originalPdf]);

  // Auto-tailor when JD changes
  useEffect(() => {
    const handler = setTimeout(() => {
      const normInput = jdInput.toLowerCase().replace(/\s+/g, " ").trim();
      const normLast = lastTailoredJd.toLowerCase().replace(/\s+/g, " ").trim();
      if (step === 2 && resume && normInput.length > 50 && !isTailoring && normInput !== normLast) {
        handleTailor();
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [jdInput, step, resume, isTailoring, lastTailoredJd]);

  // Update PDF preview when changes are approved/rejected (debounced to group consecutive clicks)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!tailoredResult || !originalPdf) return;
      const dataToExport = buildFinalResume();
      if (!dataToExport) return;
      try {
        const blob = await exportPDF(dataToExport, originalPdf, tailoredResult.changes);
        
        // Convert Blob to Base64 Data URL to bypass Chrome Extension CSP iframe restrictions
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setPreviewPdfUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error("Failed to update PDF preview", err);
      }
    }, 2000); // 2000ms debounce to group approvals together

    return () => {
      clearTimeout(timer);
    };
  }, [tailoredResult, originalPdf]);

  const triggerPageScan = () => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "REQUEST_PAGE_SCAN" }).catch(() => {});
        }
      });
    }
  };

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
          setLastTailoredJd(savedJD);
        }
        if (savedPdf) {
          setOriginalPdf(savedPdf);
        }
      } catch (err) {
        console.error("Error loading saved data:", err);
      }
      triggerPageScan();
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

  // Track SidePanel open state in storage and notify active tab to hide floating button
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ rt_sidepanel_open: true });
      chrome.tabs.query({ active: true }, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: "SIDEPANEL_OPENED" }).catch(() => {});
          }
        });
      });
    }

    return () => {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.set({ rt_sidepanel_open: false });
        chrome.tabs.query({ active: true }, (tabs) => {
          tabs.forEach((tab) => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, { type: "SIDEPANEL_CLOSED" }).catch(() => {});
            }
          });
        });
      }
    };
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
      triggerPageScan();
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
      triggerPageScan();
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

  // Handler: Tailor Resume (Progressive)
  const handleTailor = async () => {
    if (!resume || !jdInput.trim()) return;

    setIsTailoring(true);
    setLastTailoredJd(jdInput); // Set immediately to prevent auto-tailoring loop on errors
    setError("");
    setTailoredResult(null);
    const diffHelper = (section: string, field: string, label: string, orig: string, newVal: string): TailoredChange | null => {
      if (!orig && !newVal) return null;
      if (orig.trim() !== newVal.trim()) {
        return { id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, section, field, label, originalValue: orig, newValue: newVal, status: "pending" };
      }
      return null;
    };
    try {
      setIsParsingJD(true);
      const parsedJD = await parseJD({ text: jdInput });
      setIsParsingJD(false);

      const failedSections: { section: string; error: string }[] = [];

      // Start all calls in parallel
      const scorePromise = scoreResume(resume, parsedJD);
      
      const summaryPromise = resume.summary
        ? tailorSection("summary", resume.summary, parsedJD).catch(e => {
            console.error("Summary tailor failed", e);
            failedSections.push({ section: "Summary", error: e.message || String(e) });
            return null;
          })
        : Promise.resolve(null);
        
      const experiencePromise = resume.experience && resume.experience.length > 0
        ? tailorSection("experience", resume.experience, parsedJD).catch(e => {
            console.error("Experience tailor failed", e);
            failedSections.push({ section: "Experience", error: e.message || String(e) });
            return null;
          })
        : Promise.resolve(null);
        
      const projectsPromise = resume.projects && resume.projects.length > 0
        ? tailorSection("projects", resume.projects, parsedJD).catch(e => {
            console.error("Projects tailor failed", e);
            failedSections.push({ section: "Projects", error: e.message || String(e) });
            return null;
          })
        : Promise.resolve(null);
        
      const skillsPromise = resume.skills
        ? tailorSection("skills", resume.skills, parsedJD).catch(e => {
            console.error("Skills tailor failed", e);
            failedSections.push({ section: "Skills", error: e.message || String(e) });
            return null;
          })
        : Promise.resolve(null);

      // Await score first to initialize result
      const score = await scorePromise;

      let currentResult: TailoredResult = {
        tailoredResume: resume,
        changes: [],
        atsScore: score.atsScore,
        scoreReasoning: score.scoreReasoning,
        matchedKeywords: score.matchedKeywords,
        missingKeywords: score.missingKeywords,
        jobTitle: parsedJD.jobTitle,
        company: parsedJD.company,
      };

      setTailoredResult({ ...currentResult });

      // Helper to append changes and trigger re-render
      const appendChanges = (newChanges: TailoredChange[]) => {
        if (newChanges.length === 0) return;
        currentResult = {
          ...currentResult,
          changes: [...currentResult.changes, ...newChanges]
        };
        setTailoredResult(prev => {
          if (!prev) return currentResult;
          const updated = {
            ...prev,
            changes: [...prev.changes, ...newChanges]
          };
          saveTailoredResult(updated);
          return updated;
        });
      };

      // Wait for all other tailoring tasks in parallel but append their results instantly as they finish
      const tasks = [];

      tasks.push(summaryPromise.then(summaryRes => {
        if (summaryRes && summaryRes.summary) {
          const ch = diffHelper("summary", "summary", "Professional Summary", resume.summary, summaryRes.summary);
          if (ch) appendChanges([ch]);
        }
      }));

      tasks.push(experiencePromise.then(experienceRes => {
        const newCh: TailoredChange[] = [];
        if (experienceRes && experienceRes.experience && Array.isArray(experienceRes.experience)) {
          for (let i = 0; i < resume.experience.length; i++) {
            const origJob = resume.experience[i];
            const tailJob = experienceRes.experience[i];
            if (!tailJob) continue;
            
            const maxBullets = Math.max(origJob.highlights?.length || 0, tailJob.highlights?.length || 0);
            for (let j = 0; j < maxBullets; j++) {
              const origB = origJob.highlights?.[j] || "";
              const tailB = tailJob.highlights?.[j] || "";
              const ch = diffHelper("experience", `experience[${i}].highlights[${j}]`, `${origJob.role} at ${origJob.company} — Bullet ${j + 1}`, origB, tailB);
              if (ch) newCh.push(ch);
            }
          }
        }
        appendChanges(newCh);
      }));

      tasks.push(projectsPromise.then(projectsRes => {
        const newCh: TailoredChange[] = [];
        if (projectsRes && projectsRes.projects && Array.isArray(projectsRes.projects)) {
          for (let i = 0; i < resume.projects.length; i++) {
            const origP = resume.projects[i];
            const tailP = projectsRes.projects[i];
            if (!tailP) continue;
            
            const chDesc = diffHelper("projects", `projects[${i}].description`, `${origP.name} — Description`, origP.description || "", tailP.description || "");
            if (chDesc) newCh.push(chDesc);
            
            const maxBullets = Math.max(origP.highlights?.length || 0, tailP.highlights?.length || 0);
            for (let j = 0; j < maxBullets; j++) {
              const origB = origP.highlights?.[j] || "";
              const tailB = tailP.highlights?.[j] || "";
              const chB = diffHelper("projects", `projects[${i}].highlights[${j}]`, `${origP.name} — Bullet ${j + 1}`, origB, tailB);
              if (chB) newCh.push(chB);
            }
          }
        }
        appendChanges(newCh);
      }));

      tasks.push(skillsPromise.then(skillsRes => {
        const newCh: TailoredChange[] = [];
        if (skillsRes && skillsRes.skills) {
          const cats: Array<{ key: keyof SkillsData; label: string }> = [
            { key: "languages", label: "Skills — Languages" },
            { key: "frameworks", label: "Skills — Frameworks" },
            { key: "tools", label: "Skills — Tools/Databases" },
            { key: "other", label: "Skills — Other" },
          ];
          for (const cat of cats) {
            const origVal = (resume.skills[cat.key] || []).join(", ");
            const tailVal = (skillsRes.skills[cat.key] || []).join(", ");
            const ch = diffHelper("skills", `skills.${cat.key}`, cat.label, origVal, tailVal);
            if (ch) newCh.push(ch);
          }
        }
        appendChanges(newCh);
      }));

      await Promise.all(tasks);

      if (failedSections.length > 0) {
        const errorMsg = "Failed to tailor some sections due to LLM provider errors:\n" + 
          failedSections.map(f => `• ${f.section}: ${f.error}`).join("\n");
        setError(errorMsg);
      }

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
    return applyApprovedChanges(resume, tailoredResult.changes);
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

      const candidateName = dataToExport.name.replace(/\s+/g, "_");
      const title = tailoredResult?.jobTitle ? tailoredResult.jobTitle.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_") : "Tailored";
      const companyName = tailoredResult?.company ? tailoredResult.company.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_") : "";
      const filename = `${candidateName}_${title}${companyName ? `_${companyName}` : ""}.pdf`;

      triggerDownload(blob, filename);
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

      const candidateName = dataToExport.name.replace(/\s+/g, "_");
      const title = tailoredResult?.jobTitle ? tailoredResult.jobTitle.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_") : "Tailored";
      const companyName = tailoredResult?.company ? tailoredResult.company.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_") : "";
      const filename = `${candidateName}_${title}${companyName ? `_${companyName}` : ""}.docx`;

      triggerDownload(blob, filename);
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
    setTailoredResult(null);
    setStep(1);
    setError("");
    triggerPageScan();
  };

  // Compute dynamic stats based on approved changes
  const dynamicStats = useMemo(() => {
    if (!tailoredResult) return null;

    let matched = [...tailoredResult.matchedKeywords];
    let missing = [...tailoredResult.missingKeywords];
    const approvedChanges = tailoredResult.changes.filter((c) => c.status === "approved");

    // Move resolved keywords to matched list
    approvedChanges.forEach((change) => {
      const text = change.newValue.toLowerCase();
      missing = missing.filter((kw) => {
        const isMatch = text.includes(kw.toLowerCase());
        if (isMatch && !matched.includes(kw)) {
          matched.push(kw);
        }
        return !isMatch;
      });
    });

    const totalChanges = tailoredResult.changes.length;
    let score = Number(tailoredResult.atsScore) || 0;
    if (totalChanges > 0) {
      const approvedRatio = approvedChanges.length / totalChanges;
      // Interpolate from initial score to 95% maximum
      score = Math.round(score + approvedRatio * (95 - score));
    }

    return {
      score,
      matchedKeywords: matched,
      missingKeywords: missing,
    };
  }, [tailoredResult]);

  // Compute change stats
  const changeStats = tailoredResult
    ? {
        total: tailoredResult.changes.length,
        approved: tailoredResult.changes.filter((c) => c.status === "approved").length,
        rejected: tailoredResult.changes.filter((c) => c.status === "rejected").length,
        pending: tailoredResult.changes.filter((c) => c.status === "pending").length,
      }
    : null;


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
        <div className="flex items-center gap-2">
          {!isInsideIframe && tailoredResult && (
            <button
              onClick={() => {
                if (chrome.runtime && chrome.runtime.sendMessage) {
                  chrome.runtime.sendMessage({ type: "OPEN_CUSTOMIZER" });
                }
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-gray-100 transition-all duration-200 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
              title="Expand to Full Page Pop-up"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
              Expand
            </button>
          )}
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-gray-100 transition-all duration-200"
            title="Reset App State"
          >
            <RefreshCw size={16} />
          </button>
        </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start flex-1 w-full">
          {/* Left Panel: Configuration and Changes */}
          <div className="flex flex-col gap-4 w-full">
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

            {isTailoring && !tailoredResult ? (
              <div className="w-full py-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold text-xs flex items-center justify-center gap-2 animate-pulse">
                <RefreshCw size={14} className="animate-spin" />
                {isParsingJD ? "Structuring Job Description..." : "AI Customizing Resume..."}
              </div>
            ) : !isTailoring ? (
              <div className="w-full py-2 text-center text-[10px] text-gray-400">
                AI will automatically tailor your resume when you paste a JD.
              </div>
            ) : null}
          </div>

          {/* AI TAILORED STATS */}
          {tailoredResult && dynamicStats && (
            <div className="flex flex-col gap-4 mt-2">
              {/* ATS SCORE RING & REASONING */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0">
                  <svg className="h-full w-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" className="stroke-gray-200 fill-none" strokeWidth="5" />
                    <circle
                      cx="32" cy="32" r="28"
                      className={`fill-none transition-all duration-1000 ${
                        dynamicStats.score >= 70 ? "stroke-emerald-500"
                        : dynamicStats.score >= 40 ? "stroke-amber-500"
                        : "stroke-rose-500"
                      }`}
                      strokeWidth="5"
                      strokeDasharray="175"
                      strokeDashoffset={175 - (175 * dynamicStats.score) / 100}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-sm text-gray-900">
                    {dynamicStats.score}%
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold mb-1 text-gray-900">ATS Compatibility Score</h3>
                  <p className="text-[10px] text-gray-500 line-clamp-3">{tailoredResult.scoreReasoning}</p>
                </div>
              </div>

              {/* KEYWORD BADGES */}
              <div className="flex flex-col gap-3">
                {dynamicStats.matchedKeywords.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1 flex items-center gap-1">
                      <CheckCircle size={10} className="text-emerald-500" />
                      Matched Keywords ({dynamicStats.matchedKeywords.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {dynamicStats.matchedKeywords.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-medium border border-emerald-200">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {dynamicStats.missingKeywords.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1 flex items-center gap-1">
                      <AlertTriangle size={10} className="text-amber-500" />
                      Missing Gaps ({dynamicStats.missingKeywords.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {dynamicStats.missingKeywords.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-medium border border-amber-200">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CHANGE REVIEW BAR */}
              {((changeStats && changeStats.total > 0) || isTailoring) && (
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      {isTailoring ? (
                        <>
                          <RefreshCw size={12} className="text-indigo-500 animate-spin" />
                          <span className="text-indigo-600">Generating AI Suggestions...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={12} className="text-amber-500" />
                          {changeStats?.total || 0} AI Changes to Review
                        </>
                      )}
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
                  {changeStats && changeStats.total > 0 && (
                    <>
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
                      <div className="flex gap-3 mt-1.5 text-[10px] text-gray-500 mb-4">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{changeStats.approved} approved</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />{changeStats.rejected} rejected</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{changeStats.pending} pending</span>
                      </div>
                    </>
                  )}

                  {/* Individual Changes List */}
                  <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {tailoredResult.changes.map((change) => (
                      <div key={change.id} className="p-3 rounded-lg border bg-white flex flex-col gap-2 shadow-sm border-gray-200">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{change.label}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                const up = { ...tailoredResult, changes: tailoredResult.changes.map(c => c.id === change.id ? { ...c, status: "approved" as const } : c) };
                                setTailoredResult(up); saveTailoredResult(up);
                              }}
                              className={`p-1 rounded-md transition-colors ${change.status === "approved" ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-emerald-100 hover:text-emerald-600"}`}
                            >
                              <CheckCircle size={14} />
                            </button>
                            <button
                              onClick={() => {
                                const up = { ...tailoredResult, changes: tailoredResult.changes.map(c => c.id === change.id ? { ...c, status: "rejected" as const } : c) };
                                setTailoredResult(up); saveTailoredResult(up);
                              }}
                              className={`p-1 rounded-md transition-colors ${change.status === "rejected" ? "bg-rose-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-rose-100 hover:text-rose-600"}`}
                            >
                              <XCircle size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="text-[10px] text-gray-500 line-through decoration-rose-300">{change.originalValue}</div>
                        <textarea
                          value={change.newValue}
                          onChange={(e) => {
                            const up = { ...tailoredResult, changes: tailoredResult.changes.map(c => c.id === change.id ? { ...c, newValue: e.target.value } : c) };
                            setTailoredResult(up);
                            saveTailoredResult(up);
                          }}
                          className="text-xs text-gray-800 font-medium bg-gray-50 border border-gray-200 rounded p-2 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 w-full resize-y min-h-[60px]"
                        />
                      </div>
                    ))}
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

          </div>

          {/* Right Panel: Full Resume Document View */}
          <div className="flex flex-col gap-0 border-t lg:border-t-0 lg:border-l border-gray-200 pt-4 lg:pt-0 lg:pl-6 w-full lg:sticky lg:top-4">
            <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Eye size={12} />
              {tailoredResult ? "Tailored Resume — Review Changes" : "Master Resume Preview"}
            </h3>

            {/* Resume Document Container — Shows real-time preview (borderless, no grey toolbar) */}
            {previewPdfUrl ? (
              <div className="w-full overflow-hidden" style={{ height: isInsideIframe ? 'calc(100vh - 160px)' : '600px' }}>
                <iframe 
                  src={`${previewPdfUrl}#toolbar=0&view=FitH`} 
                  className="w-full h-full border-none"
                  title="Resume Preview"
                />
              </div>
            ) : (
              <div className="p-5 text-center text-gray-500">
                <p>No original PDF available for preview.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



