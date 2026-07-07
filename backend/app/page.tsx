"use client";

import React, { useState } from "react";

const AI_MODELS = [
  { id: "deepseek-ai/deepseek-v4-pro", name: "DeepSeek V4 Pro", icon: "https://www.google.com/s2/favicons?domain=deepseek.com&sz=128" },
  { id: "moonshotai/kimi-k2.6", name: "Kimi K2.6", icon: "https://www.google.com/s2/favicons?domain=moonshot.cn&sz=128" },
  { id: "z-ai/glm-5.2", name: "GLM-5.2", icon: "https://www.google.com/s2/favicons?domain=zhipuai.cn&sz=128" }
];

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

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [jdText, setJdText] = useState("");
  const [status, setStatus] = useState<"idle" | "parsing" | "tailoring" | "compiling" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("");
  const [fileKey, setFileKey] = useState(0);
  
  const [primaryModel, setPrimaryModel] = useState(AI_MODELS[0].id);

  const handleReset = () => {
    setFile(null);
    setJdText("");
    setStatus("idle");
    setErrorMessage("");
    setPdfUrl(null);
    setDownloadName("");
    setFileKey(prev => prev + 1);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!file || !jdText.trim()) {
      setErrorMessage("Please provide both a resume file and a job description.");
      setStatus("error");
      return;
    }

    try {
      setStatus("parsing");
      setErrorMessage("");
      setPdfUrl(null);

      // 1. Parse Resume
      const formData = new FormData();
      formData.append("file", file);
      formData.append("primaryModel", primaryModel);
      const resumeRes = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });
      if (!resumeRes.ok) throw new Error("Failed to parse resume");
      const resumeData = await resumeRes.json();

      // 2. Parse JD
      const jdRes = await fetch("/api/parse-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: jdText, modelSelection: { primaryModel } }),
      });
      if (!jdRes.ok) throw new Error("Failed to parse job description");
      const jdData = await jdRes.json();

      // 3. Tailor Resume using AI backend
      setStatus("tailoring");
      const tailorRes = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeData, jdData, modelSelection: { primaryModel } }),
      });
      if (!tailorRes.ok) throw new Error("Failed to tailor resume");
      const tailoredResult = await tailorRes.json();
      
      // Extract dynamic download name
      const candidateName = tailoredResult.tailoredResume?.name?.trim().replace(/[^a-zA-Z0-9]/g, "_") || "Candidate";
      const jobTitle = jdData?.jobTitle?.trim().replace(/[^a-zA-Z0-9]/g, "_") || "Professional";
      setDownloadName(`${candidateName}_${jobTitle}_Resume.pdf`);

      // 4. Compile LaTeX to PDF
      setStatus("compiling");
      const compileRes = await fetch("/api/generate-latex-pdf", {
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
        <div className="w-full max-w-3xl bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col gap-6">
            
            {/* Upload Section */}
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

            {/* JD Input */}
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

            {/* AI Model Selection */}
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

            {/* Status & Actions */}
            <div className="flex flex-col items-center gap-4 mt-2">
              
              {status === "error" && (
                <div className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium text-center">
                  {errorMessage}
                </div>
              )}

              {["parsing", "tailoring", "compiling"].includes(status) && (
                <div className="w-full mt-4 flex flex-col gap-4 p-6 bg-white/5 border border-white/10 rounded-2xl">
                  <h4 className="text-center text-sm font-bold tracking-widest uppercase text-indigo-300 mb-2 animate-pulse">
                    Crafting your ATS Resume
                  </h4>
                  <div className="flex flex-col gap-3">
                    {/* Step 1: Parsing */}
                    <div className={`flex items-center gap-3 transition-opacity duration-500 ${status === "parsing" ? "opacity-100" : "opacity-40"}`}>
                      <div className="relative flex items-center justify-center w-8 h-8">
                        {status === "parsing" ? (
                          <>
                            <div className="absolute inset-0 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                            <div className="h-2 w-2 bg-indigo-400 rounded-full animate-ping"></div>
                          </>
                        ) : (
                          <div className="h-6 w-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                        )}
                      </div>
                      <span className={`text-sm font-medium ${status === "parsing" ? "text-indigo-300" : "text-emerald-400"}`}>
                        Extracting Resume & Job Description
                      </span>
                    </div>

                    {/* Step 2: Tailoring */}
                    <div className={`flex items-center gap-3 transition-opacity duration-500 ${["parsing"].includes(status) ? "opacity-30" : status === "tailoring" ? "opacity-100" : "opacity-40"}`}>
                      <div className="relative flex items-center justify-center w-8 h-8">
                        {status === "tailoring" ? (
                          <>
                            <div className="absolute inset-0 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                            <div className="h-2 w-2 bg-purple-400 rounded-full animate-ping"></div>
                          </>
                        ) : ["compiling", "success"].includes(status) ? (
                          <div className="h-6 w-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                        ) : (
                          <div className="h-2 w-2 bg-slate-600 rounded-full"></div>
                        )}
                      </div>
                      <span className={`text-sm font-medium ${status === "tailoring" ? "text-purple-300" : ["compiling", "success"].includes(status) ? "text-emerald-400" : "text-slate-500"}`}>
                        AI Tailoring (Matching JD keywords...)
                      </span>
                    </div>

                    {/* Step 3: Compiling */}
                    <div className={`flex items-center gap-3 transition-opacity duration-500 ${["parsing", "tailoring"].includes(status) ? "opacity-30" : "opacity-100"}`}>
                      <div className="relative flex items-center justify-center w-8 h-8">
                        {status === "compiling" ? (
                          <>
                            <div className="absolute inset-0 border-2 border-pink-400 border-t-transparent rounded-full animate-spin"></div>
                            <div className="h-2 w-2 bg-pink-400 rounded-full animate-ping"></div>
                          </>
                        ) : status === "success" ? (
                          <div className="h-6 w-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                        ) : (
                          <div className="h-2 w-2 bg-slate-600 rounded-full"></div>
                        )}
                      </div>
                      <span className={`text-sm font-medium ${status === "compiling" ? "text-pink-300" : status === "success" ? "text-emerald-400" : "text-slate-500"}`}>
                        Compiling LaTeX PDF
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {status === "success" && pdfUrl ? (
                <div className="flex flex-col items-center gap-4 w-full mt-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium text-center w-full">
                    Success! Your resume has been tailored and compiled successfully.
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                    <a 
                      href={pdfUrl} 
                      download={downloadName}
                      className="w-full sm:w-auto px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-center"
                    >
                      Download PDF
                    </a>
                    <button 
                      onClick={handleReset}
                      className="w-full sm:w-auto px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all text-center"
                    >
                      Start Over
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                  <button 
                    onClick={handleGenerate}
                    disabled={["parsing", "tailoring", "compiling"].includes(status)}
                    className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-center"
                  >
                    Generate Tailored PDF
                  </button>
                  {(file || jdText) && (
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
          <span>Powered by Groq & LaTeX.</span>
        </div>
      </footer>
    </div>
  );
}
