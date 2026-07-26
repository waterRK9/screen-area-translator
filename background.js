chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translateArea",
    title: "Select Area to Translate (Option+Shift+X)",
    contexts: ["all"]
  });
});

async function sendStartSelection(tabId) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, { action: "startSelection" });
  } catch (err) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"]
      });
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { action: "startSelection" });
      }, 100);
    } catch (injectErr) {
      console.warn("Cannot run on restricted page:", injectErr);
    }
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "translate-area") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) sendStartSelection(tabs[0].id);
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translateArea" && tab?.id) sendStartSelection(tab.id);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "captureTab") {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, (dataUrl) => {
      sendResponse({ dataUrl: dataUrl });
    });
    return true;
  }

  if (request.action === "sendToGemini") {
    handleTranslationRouter(request.base64Data, sender.tab.id);
  }
});

// Master Translation Router
async function handleTranslationRouter(base64Data, tabId) {
  const cfg = await chrome.storage.sync.get([
    'provider', 'geminiApiKey', 'geminiModel',
    'openaiKey', 'openaiModel', 
    'claudeKey', 'claudeModel', 
    'baseUrl', 'modelName', 'customApiKey', 'targetLanguage'
  ]);

  const provider = cfg.provider || 'gemini';
  const targetLanguage = cfg.targetLanguage || 'English';
  const prompt = `Translate all text visible in this captured screen image into ${targetLanguage}. Format the text cleanly matching reading order. Provide ONLY the translated text without commentary or preamble.`;

  try {
    if (provider === 'openai') {
      const model = cfg.openaiModel?.trim() || 'gpt-4o-mini';
      await handleOpenAIGeneric('https://api.openai.com/v1', model, cfg.openaiKey, base64Data, prompt, tabId);
    } else if (provider === 'claude') {
      const model = cfg.claudeModel?.trim() || 'claude-3-5-sonnet-20241022';
      await handleClaudeTranslation(cfg.claudeKey, model, base64Data, prompt, tabId);
    } else if (provider === 'ollama') {
      const model = cfg.modelName?.trim() || 'llama3.2-vision';
      await handleOllamaTranslation(cfg.baseUrl || 'http://localhost:11434', model, base64Data, prompt, tabId);
    } else if (provider === 'custom') {
      const model = cfg.modelName?.trim() || 'llava';
      await handleOpenAIGeneric(cfg.baseUrl || 'http://localhost:8000/v1', model, cfg.customApiKey || '', base64Data, prompt, tabId);
    } else {
      await handleGeminiTranslation(cfg, prompt, base64Data, tabId);
    }
  } catch (err) {
    chrome.tabs.sendMessage(tabId, { 
      action: "showError", 
      text: `Error (${provider}): ${err.message}` 
    });
  }
}

// Gemini Handler: Custom Model or Dynamic Free-Tier Candidates
async function getGeminiModelCandidates(apiKey, userSpecifiedModel) {
  if (userSpecifiedModel && userSpecifiedModel.trim() !== "") {
    return [userSpecifiedModel.trim()];
  }

  const fallbackList = ["models/gemini-flash-latest", "models/gemini-2.5-flash-lite", "models/gemini-1.5-flash"];
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    
    if (data.models && data.models.length > 0) {
      const visionModels = data.models.filter(m => {
        const name = m.name.toLowerCase();
        const supportsGenerate = m.supportedGenerationMethods?.includes("generateContent");
        const isFlash = name.includes("flash");
        const isGemma = name.includes("gemma");

        const modalities = (m.inputModalities || m.input_modalities || []).map(x => x.toUpperCase());
        const supportsImage = modalities.length > 0 
          ? modalities.includes("IMAGE") 
          : (!name.includes("text") && !name.includes("tts") && !name.includes("embed"));

        return supportsGenerate && isFlash && !isGemma && supportsImage;
      }).map(m => m.name);

      if (visionModels.length > 0) return visionModels.reverse();
    }
  } catch (err) {
    console.warn("Could not fetch models list, using fallbacks:", err);
  }
  return fallbackList;
}

async function handleGeminiTranslation(cfg, prompt, base64Data, tabId) {
  const apiKey = cfg.geminiApiKey;
  if (!apiKey) throw new Error("Gemini API key is missing! Paste it in extension settings.");

  const modelCandidates = await getGeminiModelCandidates(apiKey, cfg.geminiModel);
  let lastError = null;

  for (const modelPath of modelCandidates) {
    try {
      const cleanPath = modelPath.startsWith('models/') ? modelPath : `models/${modelPath}`;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${cleanPath}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: base64Data.mimeType, data: base64Data.base64 } }
              ]
            }]
          })
        }
      );

      const data = await response.json();

      if (data.error) {
        if (data.error.code === 429 || data.error.message?.includes("Quota exceeded")) {
          lastError = data.error.message;
          continue; 
        }
        throw new Error(data.error.message || "API Request Failed");
      }

      const translation = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (translation) {
        chrome.tabs.sendMessage(tabId, { action: "showTranslation", text: translation });
        return;
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  chrome.tabs.sendMessage(tabId, { 
    action: "showError", 
    text: `Translation failed: ${lastError}` 
  });
}

// OpenAI & Generic OpenAI-Compatible Handler
async function handleOpenAIGeneric(baseUrl, model, apiKey, base64Data, prompt, tabId) {
  const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: headers,
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${base64Data.mimeType};base64,${base64Data.base64}` }
            }
          ]
        }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Server returned ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (text) {
    chrome.tabs.sendMessage(tabId, { action: "showTranslation", text: text.trim() });
  } else {
    throw new Error("No text response returned from model.");
  }
}

// Anthropic Claude Handler
async function handleClaudeTranslation(apiKey, model, base64Data, prompt, tabId) {
  if (!apiKey) throw new Error("Anthropic API Key is missing!");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerously-allow-browser": "true"
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: base64Data.mimeType,
                data: base64Data.base64
              }
            },
            { type: "text", text: prompt }
          ]
        }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API returned ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (text) {
    chrome.tabs.sendMessage(tabId, { action: "showTranslation", text: text.trim() });
  } else {
    throw new Error("Claude returned empty text.");
  }
}

// Ollama Native Handler
async function handleOllamaTranslation(baseUrl, model, base64Data, prompt, tabId) {
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model,
      prompt: prompt,
      images: [base64Data.base64],
      stream: false
    })
  });

  if (!res.ok) throw new Error(`Ollama returned ${res.status}. Ensure Ollama is running and '${model}' is pulled.`);

  const data = await res.json();
  if (data.response) {
    chrome.tabs.sendMessage(tabId, { action: "showTranslation", text: data.response.trim() });
  } else {
    throw new Error("Ollama returned empty response.");
  }
}