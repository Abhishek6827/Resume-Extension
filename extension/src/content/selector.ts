let floatingBtn: HTMLButtonElement | null = null;
let selectedText = "";

/**
 * Remove any existing floating button from the DOM
 */
function removeButton() {
  if (floatingBtn) {
    floatingBtn.remove();
    floatingBtn = null;
  }
}

/**
 * Creates and positions the floating button near selection bounds
 */
function showFloatingButton(x: number, y: number) {
  removeButton();

  floatingBtn = document.createElement("button");
  floatingBtn.id = "rt-floating-button";
  floatingBtn.innerText = "🔮 Tailor with this JD";

  // Position
  floatingBtn.style.position = "absolute";
  floatingBtn.style.top = `${y + window.scrollY - 40}px`;
  floatingBtn.style.left = `${x + window.scrollX}px`;
  floatingBtn.style.zIndex = "2147483647"; // Max priority

  // Design styles (injected inline to prevent host site CSS collision)
  floatingBtn.style.background = "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)";
  floatingBtn.style.color = "#ffffff";
  floatingBtn.style.border = "none";
  floatingBtn.style.borderRadius = "20px";
  floatingBtn.style.padding = "8px 16px";
  floatingBtn.style.fontSize = "12px";
  floatingBtn.style.fontWeight = "600";
  floatingBtn.style.cursor = "pointer";
  floatingBtn.style.boxShadow = "0 4px 15px rgba(99, 102, 241, 0.4)";
  floatingBtn.style.transition = "transform 0.2s ease, opacity 0.2s ease";
  floatingBtn.style.fontFamily = "system-ui, sans-serif";

  // Hover animations
  floatingBtn.onmouseenter = () => {
    if (floatingBtn) floatingBtn.style.transform = "scale(1.05)";
  };
  floatingBtn.onmouseleave = () => {
    if (floatingBtn) floatingBtn.style.transform = "scale(1)";
  };

  // Button click triggers background reload
  floatingBtn.onmousedown = (e) => {
    e.preventDefault(); // prevent losing selection before sending message
    if (selectedText.trim()) {
      chrome.runtime.sendMessage({
        type: "JD_SELECTED",
        data: { text: selectedText },
      });
      removeButton();
    }
  };

  document.body.appendChild(floatingBtn);
}

// Listen for text selection changes
document.addEventListener("mouseup", (e) => {
  const selection = window.getSelection();
  const text = (selection?.toString() || "").trim();

  if (text.length > 100) {
    selectedText = text;
    // Position button near client click
    showFloatingButton(e.clientX, e.clientY);
  } else {
    // If user clicked inside the button itself, don't remove it
    if (e.target instanceof HTMLElement && e.target.id === "rt-floating-button") {
      return;
    }
    removeButton();
  }
});

// Clear button on new selection starts
document.addEventListener("mousedown", (e) => {
  if (e.target instanceof HTMLElement && e.target.id === "rt-floating-button") {
    return;
  }
  removeButton();
});
