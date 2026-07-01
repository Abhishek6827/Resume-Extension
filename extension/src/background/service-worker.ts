// ─── Resume Tailor — Background Service Worker ─────────────

// Configure side panel opening behavior
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("[service-worker] setPanelBehavior error:", error));

// Create context menu for manual highlights
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "rt-use-as-jd",
    title: "🔮 Use as Job Description",
    contexts: ["selection"],
  });
});

let cachedJDText = "";

/**
 * Handle messages from content scripts and side panel
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "JD_DETECTED" || message.type === "JD_SELECTED") {
    const jdText = message.data.text || "";
    cachedJDText = jdText;

    // Cache the last detected JD in storage
    chrome.storage.local.set({ rt_last_detected_jd: jdText }).then(() => {
      console.log("[service-worker] Job description cached in storage");
    });

    // JD is cached. User can open the popup manually to customize.

    if (sender.tab?.id) {
      // Update extension badge to signal JD detected
      chrome.action.setBadgeText({ text: "✨", tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: "#6366f1", tabId: sender.tab.id });
    }
    
    sendResponse({ status: "success" });
  } else if (message.type === "GET_CACHED_JD") {
    sendResponse({ jdText: cachedJDText });
  }
  return true;
});

/**
 * Context menu listener
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "rt-use-as-jd" && tab?.id) {
    const selection = info.selectionText || "";
    cachedJDText = selection;

    chrome.storage.local.set({ rt_last_detected_jd: selection }).then(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL("src/sidepanel/index.html") }).catch((err: any) => {
        console.error("[service-worker] Failed to open full page tab via context menu:", err);
      });
      chrome.action.setBadgeText({ text: "✨", tabId: tab.id });
    });
  }
});
