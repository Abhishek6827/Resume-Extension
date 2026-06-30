import React from "react";

export const metadata = {
  title: "Resume Tailor API Service",
  description:
    "AI-powered ATS optimization and resume tailoring service. Install the companion Chrome Extension to optimize your resume directly on job pages.",
};

export default function Home() {
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

      {/* Main Hero */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 flex flex-col items-center justify-center text-center py-12">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
          AI-Powered Resume Tailoring <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
            Directly in Your Browser
          </span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-12 leading-relaxed">
          Resume Tailor scans job descriptions on LinkedIn, Indeed, Naukri, and more, 
          identifying matching keywords and tailoring your bullet points for peak ATS compatibility.
        </p>

        {/* Action Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mb-16 text-left">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl hover:border-indigo-500/30 transition-all duration-300">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold mb-4">
              1
            </div>
            <h3 className="font-bold text-lg mb-2">Install Extension</h3>
            <p className="text-sm text-slate-400">
              Load the unpacked extension folder into Chrome via Developer Mode to activate the companion sidebar.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl hover:border-indigo-500/30 transition-all duration-300">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold mb-4">
              2
            </div>
            <h3 className="font-bold text-lg mb-2">Upload Resume</h3>
            <p className="text-sm text-slate-400">
              Upload your PDF/DOCX resume once in the extension side panel. It remains securely in your browser.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl hover:border-indigo-500/30 transition-all duration-300">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold mb-4">
              3
            </div>
            <h3 className="font-bold text-lg mb-2">Instant Tailor</h3>
            <p className="text-sm text-slate-400">
              Navigate to any job page. Select or auto-detect the job description, check your ATS score, and download.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Resume Tailor. All rights reserved.</p>
        <div className="flex gap-6">
          <span>Secure. Private. ATS-Optimized.</span>
        </div>
      </footer>
    </div>
  );
}
