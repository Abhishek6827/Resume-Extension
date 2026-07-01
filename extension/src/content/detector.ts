import { detectJobDescription } from "../lib/site-detectors";

let lastDetectedText = "";

function injectStyles() {
  if (document.getElementById("rt-floating-button-styles")) return;
  const style = document.createElement("style");
  style.id = "rt-floating-button-styles";
  style.innerHTML = `
    #rt-floating-button {
      animation: rt-pulse 2.5s infinite;
    }
    @keyframes rt-pulse {
      0% { box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4); }
      50% { box-shadow: 0 4px 24px rgba(168, 85, 247, 0.8); }
      100% { box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4); }
    }
  `;
  document.head.appendChild(style);
}

function createFloatingButton() {
  if (document.getElementById("rt-floating-button")) return;

  injectStyles();

  const btn = document.createElement("button");
  btn.id = "rt-floating-button";
  
  // Style properties
  btn.style.position = "fixed";
  btn.style.bottom = "24px";
  btn.style.right = "24px";
  btn.style.zIndex = "2147483647"; // absolute maximum z-index to stay on top
  btn.style.width = "50px";
  btn.style.height = "50px";
  btn.style.borderRadius = "50%";
  btn.style.border = "none";
  btn.style.cursor = "pointer";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.background = "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)";
  btn.style.color = "#ffffff";
  btn.style.transition = "transform 0.2s ease, opacity 0.2s ease";
  
  // Sparkles SVG Icon
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5z"/>
      <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/>
    </svg>
  `;

  // Hover transitions
  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "scale(1.1)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "scale(1.0)";
  });

  // Action: Open Customizer Window
  btn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_CUSTOMIZER" });
  });

  document.body.appendChild(btn);
}

/**
 * Scan page and notify background if new JD is detected
 */
function scanPage() {
  try {
    const result = detectJobDescription();
    if (result.found && result.text !== lastDetectedText) {
      lastDetectedText = result.text;
      console.log(`[Resume Tailor] Detected Job Description via: ${result.source}`);
      chrome.runtime.sendMessage({
        type: "JD_DETECTED",
        data: {
          text: result.text,
          confidence: result.confidence,
          source: result.source,
        },
      });
      // Show floating tailoring helper button
      createFloatingButton();
    }
  } catch (err) {
    console.error("[Resume Tailor] Detector error:", err);
  }
}

// 1. Initial execution on document idle
scanPage();

// 2. Debounced observer for dynamic SPAs (e.g. LinkedIn AJAX jobs load)
let timeoutId: number | null = null;
const observer = new MutationObserver(() => {
  if (timeoutId) window.clearTimeout(timeoutId);
  timeoutId = window.setTimeout(() => {
    scanPage();
  }, 1000);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
