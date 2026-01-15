
if (!window.tosScannerInjected) {
  window.tosScannerInjected = true;

  let currentOffset = 0;
  const CHUNK_SIZE = 30000;
  let totalAlerts = { red: 0, orange: 0, green: 0 };
  let isPanelOpen = false;

  createFloatingUI();


  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanPage") {
      resetStats();
      scanTextChunk(true, sendResponse);
      return true;
    }
    if (request.action === "togglePanel") {
      togglePanel(true);
      return;
    }
    if (request.action === "openGemini") {
      openGeminiDeepDive();
      return;
    }
  });

  function createFloatingUI() {
    const container = document.createElement('div');
    container.id = 'tos-floating-container';
    
    const btn = document.createElement('div');
    btn.id = 'tos-floating-btn';
    btn.innerHTML = '🕵️‍♂️';
    btn.title = "Terms Detective";

    // The Small 'X' Badge to close fully from minimized state
    const closeBadge = document.createElement('div');
    closeBadge.id = 'tos-floating-close-trigger';
    closeBadge.innerHTML = '✖';
    closeBadge.title = "Close Detective Fully";

    container.appendChild(btn);
    container.appendChild(closeBadge);
    
    // The Main Window Panel
    const panel = document.createElement('div');
    panel.id = 'tos-panel';
    panel.innerHTML = `
      <div class="tos-header">
        <div class="tos-header-title">🕵️‍♂️ Terms Detective</div>
        <div class="tos-window-controls">
          <div class="tos-win-btn minimize" id="tos-win-min" title="Minimize">−</div>
          <div class="tos-win-btn close" id="tos-win-close" title="Close Fully">✕</div>
        </div>
      </div>
      <div class="tos-body">
        <div id="tos-status-text">Ready to scan.</div>
        
        <div class="tos-stats-row">
          <div class="tos-stat"><span class="tos-stat-val stat-red" id="stat-red">0</span>Critical</div>
          <div class="tos-stat"><span class="tos-stat-val stat-orange" id="stat-orange">0</span>Caution</div>
          <div class="tos-stat"><span class="tos-stat-val stat-green" id="stat-green">0</span>Safe</div>
        </div>

        <button class="tos-btn tos-btn-scan" id="tos-float-scan">🔍 Scan Page</button>
        <button class="tos-btn tos-btn-next" id="tos-next-btn">⏩ Scan Next Part</button>
        <button class="tos-btn tos-btn-gemini" id="tos-gemini-btn">✨ Ask Gemini AI</button>
      </div>
    `;

    document.body.appendChild(container);
    document.body.appendChild(panel);

   
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); 
      togglePanel(true);
    });

   
    closeBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      removeUI();
    });

    panel.querySelector('#tos-win-min').addEventListener('click', () => {
      togglePanel(false);
    });


    panel.querySelector('#tos-win-close').addEventListener('click', () => {
      removeUI();
    });

    document.addEventListener('click', (event) => {
      if (isPanelOpen) {
        if (!panel.contains(event.target) && !btn.contains(event.target)) {
          togglePanel(false); 
        }
      }
    });

    panel.querySelector('#tos-float-scan').addEventListener('click', () => { resetStats(); scanTextChunk(); });
    panel.querySelector('#tos-next-btn').addEventListener('click', () => scanTextChunk());
    panel.querySelector('#tos-gemini-btn').addEventListener('click', openGeminiDeepDive);
  }

  function togglePanel(show) {
    const container = document.getElementById('tos-floating-container');
    const panel = document.getElementById('tos-panel');
    
    isPanelOpen = show;
    
    if (show) {
      panel.classList.add('visible');
      container.style.display = 'none';
    } else {
      panel.classList.remove('visible');
      container.style.display = 'flex';
    }
  }

  function removeUI() {
    const container = document.getElementById('tos-floating-container');
    const panel = document.getElementById('tos-panel');
    if (container) container.remove();
    if (panel) panel.remove();
    window.tosScannerInjected = false;
  }

  function openGeminiDeepDive() {
    const text = document.body.innerText.substring(0, 30000);
    const query = `Analyze this legal text for consumer traps:\n\n${text}`;
    window.open(`https://gemini.google.com/app?text=${encodeURIComponent(query)}`, '_blank');
  }

  // --- SCANNING LOGIC (Same as before) ---
  function resetStats() {
    totalAlerts = { red: 0, orange: 0, green: 0 };
    currentOffset = 0;
    updateStatsUI();
    document.querySelectorAll('.tos-gotcha-highlight').forEach(el => {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });
  }

  function updateStatsUI() {
    const red = document.getElementById('stat-red');
    if(red) {
        red.textContent = totalAlerts.red;
        document.getElementById('stat-orange').textContent = totalAlerts.orange;
        document.getElementById('stat-green').textContent = totalAlerts.green;
    }
  }

  function scanTextChunk(isFromPopup = false, popupCallback = null) {
    const statusEl = document.getElementById('tos-status-text');
    const nextBtn = document.getElementById('tos-next-btn');
    const floatScanBtn = document.getElementById('tos-float-scan');

    if(floatScanBtn) floatScanBtn.disabled = true;
    if(nextBtn) nextBtn.style.display = 'none';
    if(statusEl) statusEl.textContent = "Analyzing...";

    const fullText = document.body.innerText;
    const chunk = fullText.substring(currentOffset, currentOffset + CHUNK_SIZE);

    if (chunk.length < 100) {
      if(statusEl) statusEl.textContent = "End of document.";
      if(floatScanBtn) floatScanBtn.disabled = false;
      if(popupCallback) popupCallback({ status: "done", count: 0, stats: totalAlerts });
      return;
    }

    chrome.runtime.sendMessage({ action: "analyzeText", text: chunk }, (response) => {
      if(floatScanBtn) floatScanBtn.disabled = false;

      if (chrome.runtime.lastError || !response || !response.success) {
         if(statusEl) statusEl.textContent = "Error during analysis.";
         if(popupCallback) popupCallback({ status: "error", message: "Something went wrong please try again." });
         return;
      }

      const findings = response.data;
      if (findings.length > 0) {
        highlightGotchas(findings);
        if(statusEl) statusEl.textContent = `Found ${findings.length} items here.`;
      } else {
        if(statusEl) statusEl.textContent = "No issues found in this part.";
      }

      currentOffset += CHUNK_SIZE;
      if (currentOffset < fullText.length) {
        if(nextBtn) {
            nextBtn.style.display = 'block';
            nextBtn.textContent = `Scan Next Part (${Math.round(currentOffset/fullText.length * 100)}%)`;
        }
      }

      if (popupCallback) {
        popupCallback({ status: "done", count: findings.length, stats: totalAlerts });
      }
    });
  }

  function highlightGotchas(gotchas) {
    if (!Array.isArray(gotchas)) return;
    gotchas.forEach(item => {
      if(item.quote) {
          const severity = item.severity || 'red';
          if (totalAlerts[severity] !== undefined) totalAlerts[severity]++;
          findAndHighlight(document.body, item.quote, item.explanation, severity);
      }
    });
    updateStatsUI();
  }

  function findAndHighlight(root, searchText, explanation, severity) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const cleanSearch = searchText.trim().replace(/\s+/g, ' ');

    while (node = walker.nextNode()) {
      const nodeText = node.nodeValue.replace(/\s+/g, ' ');
      if (nodeText.includes(cleanSearch) && cleanSearch.length > 10) {
        const parentTag = node.parentNode.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'textarea', 'input', 'button'].includes(parentTag)) continue;
        if (node.parentNode.classList.contains('tos-gotcha-highlight')) continue;

        try {
          const span = document.createElement("span");
          span.className = `tos-gotcha-highlight tos-severity-${severity}`;
          span.setAttribute("data-tos-warning", explanation);
          span.textContent = node.nodeValue;
          node.parentNode.replaceChild(span, node);
        } catch (e) {}
        return; 
      }
    }
  }
}