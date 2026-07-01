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

let modalElement: HTMLDivElement | null = null;

function openInPageModal() {
  if (modalElement) return; // already open

  // Create full-screen fixed backdrop
  modalElement = document.createElement("div");
  modalElement.id = "rt-customizer-modal";
  modalElement.style.position = "fixed";
  modalElement.style.top = "0";
  modalElement.style.left = "0";
  modalElement.style.width = "100vw";
  modalElement.style.height = "100vh";
  modalElement.style.backgroundColor = "rgba(0,0,0,0.6)";
  modalElement.style.backdropFilter = "blur(4px)";
  modalElement.style.zIndex = "2147483647"; // max z-index
  modalElement.style.display = "flex";
  modalElement.style.alignItems = "center";
  modalElement.style.justifyContent = "center";
  modalElement.style.padding = "20px";
  modalElement.style.boxSizing = "border-box";

  // Create container for iframe
  const container = document.createElement("div");
  container.style.width = "95%";
  container.style.maxWidth = "1400px";
  container.style.height = "95%";
  container.style.backgroundColor = "#ffffff";
  container.style.borderRadius = "16px";
  container.style.boxShadow = "0 25px 50px -12px rgba(0, 0, 0, 0.5)";
  container.style.overflow = "hidden";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.position = "relative";

  // Add Close Button inside the container (top right absolute)
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "&times;";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "12px";
  closeBtn.style.right = "16px";
  closeBtn.style.width = "36px";
  closeBtn.style.height = "36px";
  closeBtn.style.borderRadius = "50%";
  closeBtn.style.backgroundColor = "#f3f4f6";
  closeBtn.style.border = "none";
  closeBtn.style.fontSize = "24px";
  closeBtn.style.lineHeight = "1";
  closeBtn.style.color = "#4b5563";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.display = "flex";
  closeBtn.style.alignItems = "center";
  closeBtn.style.justifyContent = "center";
  closeBtn.style.zIndex = "10";
  closeBtn.style.transition = "background-color 0.2s";
  closeBtn.onmouseenter = () => closeBtn.style.backgroundColor = "#e5e7eb";
  closeBtn.onmouseleave = () => closeBtn.style.backgroundColor = "#f3f4f6";

  closeBtn.onclick = () => {
    if (modalElement) {
      document.body.removeChild(modalElement);
      modalElement = null;
    }
  };

  // Iframe to load the Customizer UI
  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("src/sidepanel/index.html");
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";

  container.appendChild(closeBtn);
  container.appendChild(iframe);
  modalElement.appendChild(container);

  // Click on backdrop to close
  modalElement.addEventListener("click", (e) => {
    if (modalElement && e.target === modalElement) {
      document.body.removeChild(modalElement);
      modalElement = null;
    }
  });

  document.body.appendChild(modalElement);
}

// Listen for messages to open the modal from the background/sidepanel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OPEN_IN_PAGE_MODAL") {
    openInPageModal();
    sendResponse({ status: "success" });
  } else if (message.type === "SIDEPANEL_OPENED") {
    const btn = document.getElementById("rt-floating-button");
    if (btn) btn.style.display = "none";
    sendResponse({ status: "success" });
  } else if (message.type === "SIDEPANEL_CLOSED") {
    const btn = document.getElementById("rt-floating-button");
    if (btn) btn.style.display = "flex";
    sendResponse({ status: "success" });
  } else if (message.type === "REQUEST_PAGE_SCAN") {
    scanPage();
    sendResponse({ status: "success" });
  }
});

function createFloatingButton() {
  if (document.getElementById("rt-floating-button")) return;

  chrome.storage.local.get("rt_sidepanel_open").then((res) => {
    if (res.rt_sidepanel_open) {
      console.log("[Resume Tailor] Side panel is open. Skipping floating button injection.");
      return;
    }

    injectStyles();

    const btn = document.createElement("button");
    btn.id = "rt-floating-button";
    
    // Style properties
    btn.style.position = "fixed";
    btn.style.bottom = "24px";
    btn.style.right = "24px";
    btn.style.zIndex = "2147483646"; // just below modal
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

    // Action: Open Sidepanel
    btn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL" });
    });

    document.body.appendChild(btn);
  });
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

// Sync floating button visibility when SidePanel storage state changes (across all frames/windows)
if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && "rt_sidepanel_open" in changes) {
      const isOpen = changes.rt_sidepanel_open.newValue;
      const btn = document.getElementById("rt-floating-button");
      if (btn) {
        btn.style.display = isOpen ? "none" : "flex";
      }
    }
  });
}

