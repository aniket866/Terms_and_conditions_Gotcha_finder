document.getElementById('scanBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  const loaderEl = document.getElementById('loader');
  const btn = document.getElementById('scanBtn');
  const statsBox = document.getElementById('stats-container');

  btn.disabled = true;
  statusEl.style.display = 'none';
  statusEl.textContent = '';
  loaderEl.style.display = 'flex';
  statsBox.style.display = 'none';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
      throw new Error("Cannot scan system pages.");
    }

    try {
      await sendMessageWithRetry(tab.id, { action: "scanPage" });
    } catch (injectionError) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['css/styles.css'] });
      await sendMessageWithRetry(tab.id, { action: "scanPage" });
    }

  } catch (err) {
    loaderEl.style.display = 'none';
    btn.disabled = false;
    statusEl.style.display = 'block';
    statusEl.style.color = '#d9534f';
    statusEl.textContent = err.message || "Error occurred.";
  }
});

document.getElementById('geminiBtn').addEventListener('click', async () => {
   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
   chrome.tabs.sendMessage(tab.id, { action: "openGemini" });
});

document.getElementById('toggleFloatingBtn').addEventListener('click', async () => {
   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
   try {
     await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
     await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['css/styles.css'] });
   } catch(e) {}
   chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
   window.close();
});

// --- NEW INFO BUTTON LOGIC ---
document.getElementById('infoBtn').addEventListener('click', () => {
  const infoBox = document.getElementById('infoSection');
  infoBox.style.display = (infoBox.style.display === 'none') ? 'block' : 'none';
});

document.getElementById('closeInfoBtn').addEventListener('click', () => {
  document.getElementById('infoSection').style.display = 'none';
});

function sendMessageWithRetry(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      
      const statusEl = document.getElementById('status');
      const loaderEl = document.getElementById('loader');
      const btn = document.getElementById('scanBtn');
      const statsBox = document.getElementById('stats-container');

      loaderEl.style.display = 'none';
      btn.disabled = false;
      statusEl.style.display = 'block';

      if (response && response.status === "done") {
        const counts = response.stats || { red: 0, orange: 0, green: 0 };
        document.getElementById('count-red').textContent = counts.red;
        document.getElementById('count-orange').textContent = counts.orange;
        document.getElementById('count-green').textContent = counts.green;
        
        statsBox.style.display = 'flex';
        
        if (response.count > 0) {
            statusEl.textContent = `Found ${response.count} alerts!`;
            statusEl.style.color = "#d32f2f";
        } else {
            statusEl.textContent = "No threats found. (Page seems safe)";
            statusEl.style.color = "green";
        }
        resolve(response);
      } else if (response && response.status === "error") {
        statusEl.textContent = response.message;
        statusEl.style.color = "#d9534f";
        resolve(response);
      }
    });
  });
}