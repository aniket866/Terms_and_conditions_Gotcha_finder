// content.js

// Prevent duplicate listeners
if (typeof window.hasTosScannerListener === 'undefined') {
  window.hasTosScannerListener = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanPage") {
      
      const pageText = document.body.innerText;
      
      if (!pageText || pageText.length < 50) {
        sendResponse({ status: "error", message: "Page text is too short to analyze." });
        return true;
      }

      // Send to Background
      chrome.runtime.sendMessage({ action: "analyzeText", text: pageText }, (response) => {
        if (chrome.runtime.lastError) {
           sendResponse({ status: "error", message: "Connection error: " + chrome.runtime.lastError.message });
           return;
        }

        if (response && response.success) {
          highlightGotchas(response.data);
          sendResponse({ status: "done", count: response.data.length });
        } else {
          sendResponse({ status: "error", message: response.error || "Unknown AI error" });
        }
      });

      return true; // Keep channel open
    }
  });
}

function highlightGotchas(gotchas) {
  if (!gotchas || !Array.isArray(gotchas)) return;

  gotchas.forEach(item => {
    if(item.quote) {
        findAndHighlight(document.body, item.quote, item.explanation);
    }
  });
}

function findAndHighlight(root, searchText, explanation) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  let node;
  // Normalize whitespace (turn newlines into spaces) for better matching
  const cleanSearch = searchText.trim().replace(/\s+/g, ' ');

  while (node = walker.nextNode()) {
    const nodeText = node.nodeValue.replace(/\s+/g, ' ');
    
    if (nodeText.includes(cleanSearch) && cleanSearch.length > 10) {
      // Don't highlight inside scripts or existing highlights
      const parentTag = node.parentNode.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'textarea'].includes(parentTag)) continue;
      if (node.parentNode.classList.contains('tos-gotcha-highlight')) continue;

      try {
        const span = document.createElement("span");
        span.className = "tos-gotcha-highlight";
        span.setAttribute("data-tos-warning", explanation);
        span.textContent = node.nodeValue;
        node.parentNode.replaceChild(span, node);
      } catch (e) {
        console.error("Could not highlight node", e);
      }
      return; // Stop after first match to avoid clutter
    }
  }
}