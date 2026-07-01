// ─── Resume Tailor — Background Service Worker ─────────────

// Open Side Panel on extension toolbar icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

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
  } else if (message.type === "OPEN_CUSTOMIZER") {
    // Send message to active tab to open in-page modal
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "OPEN_IN_PAGE_MODAL" }).catch(err => {
          console.error("Failed to send OPEN_IN_PAGE_MODAL to tab:", err);
        });
      }
    });
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
  const tabId = tab?.id;
  if (info.menuItemId === "rt-use-as-jd" && tabId) {
    const selection = info.selectionText || "";
    cachedJDText = selection;

    chrome.storage.local.set({ rt_last_detected_jd: selection }).then(() => {
      chrome.tabs.sendMessage(tabId, { type: "OPEN_IN_PAGE_MODAL" }).catch(err => {
        console.error("Failed to send OPEN_IN_PAGE_MODAL to tab:", err);
      });
      chrome.action.setBadgeText({ text: "✨", tabId: tabId });
    });
  }
});
