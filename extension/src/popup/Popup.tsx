import React, { useEffect, useState } from "react";
import { Sparkles, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { getResume } from "../lib/storage";
import type { ResumeData } from "../lib/types";

export default function Popup() {
  const [resume, setResume] = useState<ResumeData | null>(null);

  useEffect(() => {
    async function loadResume() {
      try {
        const saved = await getResume();
        if (saved) setResume(saved);
      } catch (err) {
        console.error(err);
      }
    }
    loadResume();
  }, []);

  const openSidepanel = () => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id) {
          // Open the sidepanel programmatically on action button click
          chrome.sidePanel.open({ tabId: activeTab.id }).catch((err) => {
            console.error("Failed to open side panel:", err);
          });
        }
      });
    }
  };

  return (
    <div className="w-[320px] p-4 bg-[#090a0f] text-slate-200 select-none">
      {/* Title */}
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
          <span className="font-bold text-xs text-white">RT</span>
        </div>
        <span className="font-bold text-sm tracking-tight">Resume Tailor</span>
      </div>

      {/* Status Card */}
      <div className="p-3 rounded-xl bg-white/2 border border-white/5 flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Master Resume:</span>
          {resume ? (
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <CheckCircle2 size={12} />
              Uploaded
            </span>
          ) : (
            <span className="flex items-center gap-1 text-rose-400 font-semibold">
              <AlertCircle size={12} />
              Not Uploaded
            </span>
          )}
        </div>

        {resume && (
          <div className="flex gap-2 items-center text-[10px] text-slate-500 border-t border-white/5 pt-2">
            <FileText size={12} />
            <span className="truncate">{resume.name}</span>
          </div>
        )}
      </div>

      {/* Open Button */}
      <button
        onClick={openSidepanel}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 font-semibold text-xs text-white shadow-lg shadow-indigo-500/20 hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
      >
        <Sparkles size={12} />
        Open Customization Panel
      </button>

      {/* Guide Footer */}
      <div className="mt-4 text-[10px] text-center text-slate-500 leading-normal">
        Open any job posting on LinkedIn or Indeed, highlight text, and right-click to instantly tailor.
      </div>
    </div>
  );
}
