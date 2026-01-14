 
const API_KEY = ""; 

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeText") {
    
    if (!API_KEY || API_KEY.includes("YOUR_GEMINI")) {
      sendResponse({ success: false, error: "API Key is missing in background.js" });
      return true;
    }

    analyzeWithGemini(request.text)
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep message channel open for async response
  }
});

async function analyzeWithGemini(text) {
  // Uses the "latest" alias to ensure we get the active model version
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;
  
  // Truncate text to 15,000 characters to stay within safe token limits for this demo
  const safeText = text.substring(0, 15000);

  const prompt = `
    You are a lawyer. Analyze this Terms of Service text.
    Identify 3 to 5 dangerous "gotcha" clauses (e.g., selling data, forced arbitration, rights waivers).
    
    Return strictly a valid JSON array. Do NOT use Markdown formatting (no \`\`\`json).
    Format:
    [
      {
        "quote": "exact substring from the text",
        "explanation": "Brief explanation of why this is dangerous."
      }
    ]

    Text to analyze:
    ${safeText}
  `;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || `Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0].content) {
      let resultText = data.candidates[0].content.parts[0].text;
      // Clean up markdown just in case the model adds it
      resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(resultText);
    } else {
      throw new Error("No analysis returned from Gemini.");
    }
  } catch (err) {
    console.error("Gemini Request Failed:", err);
    throw err;
  }
}
