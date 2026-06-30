import { detectJobDescription } from "../lib/site-detectors";

let lastDetectedText = "";

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
