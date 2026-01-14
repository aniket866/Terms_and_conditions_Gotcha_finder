// popup/script.js

document.getElementById('scanBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  const loaderEl = document.getElementById('loader');
  const btn = document.getElementById('scanBtn');

  // UI Updates
  btn.disabled = true;
  statusEl.style.display = 'none';
  statusEl.textContent = '';
  loaderEl.style.display = 'block';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Skip internal browser pages
    if (!tab.id || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
      throw new Error("Cannot scan browser system pages.");
    }

    // Try sending message. If it fails, inject script and retry.
    try {
      await sendMessageWithRetry(tab.id, { action: "scanPage" });
    } catch (injectionError) {
      console.log("Script not ready. Injecting manually...");
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['css/styles.css']
      });

      // Retry after injection
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

function sendMessageWithRetry(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      // Chrome sets runtime.lastError if the message destination (content.js) doesn't exist
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      
      const statusEl = document.getElementById('status');
      const loaderEl = document.getElementById('loader');
      const btn = document.getElementById('scanBtn');

      loaderEl.style.display = 'none';
      btn.disabled = false;
      statusEl.style.display = 'block';

      if (response && response.status === "done") {
        statusEl.textContent = `Found ${response.count} alerts!`;
        statusEl.style.color = "green";
        resolve(response);
      } else if (response && response.status === "error") {
        statusEl.textContent = response.message;
        statusEl.style.color = "red";
        resolve(response);
      }
    });
  });
}