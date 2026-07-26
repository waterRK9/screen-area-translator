const providerSelect = document.getElementById('provider');
const geminiFields = document.getElementById('gemini-fields');
const openaiFields = document.getElementById('openai-fields');
const claudeFields = document.getElementById('claude-fields');
const customFields = document.getElementById('custom-fields');
const baseUrlInput = document.getElementById('baseUrl');
const urlHint = document.getElementById('url-hint');
const modelNameInput = document.getElementById('modelName');

function updateUI(provider) {
  geminiFields.style.display = 'none';
  openaiFields.style.display = 'none';
  claudeFields.style.display = 'none';
  customFields.style.display = 'none';

  if (provider === 'gemini') {
    geminiFields.style.display = 'block';
  } else if (provider === 'openai') {
    openaiFields.style.display = 'block';
  } else if (provider === 'claude') {
    claudeFields.style.display = 'block';
  } else if (provider === 'ollama') {
    customFields.style.display = 'block';
    urlHint.textContent = 'Ollama Default: http://localhost:11434';
    if (!baseUrlInput.value) baseUrlInput.value = 'http://localhost:11434';
    modelNameInput.placeholder = 'Leave blank for Default model';
  } else if (provider === 'custom') {
    customFields.style.display = 'block';
    urlHint.textContent = 'Example: http://localhost:8000/v1 or https://openrouter.ai/api/v1';
    if (!baseUrlInput.value) baseUrlInput.value = 'http://localhost:8000/v1';
    modelNameInput.placeholder = 'Leave blank for Default model';
  }
}

providerSelect.addEventListener('change', (e) => updateUI(e.target.value));

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(
    [
      'provider', 'geminiApiKey', 'geminiModel', 
      'openaiKey', 'openaiModel', 
      'claudeKey', 'claudeModel', 
      'baseUrl', 'modelName', 'customApiKey', 'targetLanguage'
    ],
    (res) => {
      const provider = res.provider || 'gemini';
      providerSelect.value = provider;
      
      if (res.geminiApiKey) document.getElementById('apiKey').value = res.geminiApiKey;
      if (res.geminiModel) document.getElementById('geminiModel').value = res.geminiModel;
      
      if (res.openaiKey) document.getElementById('openaiKey').value = res.openaiKey;
      if (res.openaiModel) document.getElementById('openaiModel').value = res.openaiModel;
      
      if (res.claudeKey) document.getElementById('claudeKey').value = res.claudeKey;
      if (res.claudeModel) document.getElementById('claudeModel').value = res.claudeModel;
      
      if (res.baseUrl) baseUrlInput.value = res.baseUrl;
      if (res.modelName) modelNameInput.value = res.modelName;
      if (res.customApiKey) document.getElementById('customApiKey').value = res.customApiKey;
      
      document.getElementById('targetLanguage').value = res.targetLanguage || 'English';

      updateUI(provider);
    }
  );
});

document.getElementById('save').addEventListener('click', () => {
  const settings = {
    provider: providerSelect.value,
    geminiApiKey: document.getElementById('apiKey').value.trim(),
    geminiModel: document.getElementById('geminiModel').value.trim(),
    openaiKey: document.getElementById('openaiKey').value.trim(),
    openaiModel: document.getElementById('openaiModel').value.trim(),
    claudeKey: document.getElementById('claudeKey').value.trim(),
    claudeModel: document.getElementById('claudeModel').value.trim(),
    baseUrl: baseUrlInput.value.trim().replace(/\/+$/, ''),
    modelName: modelNameInput.value.trim(),
    customApiKey: document.getElementById('customApiKey').value.trim(),
    targetLanguage: document.getElementById('targetLanguage').value.trim() || 'English'
  };

  chrome.storage.sync.set(settings, () => {
    const status = document.getElementById('status');
    status.textContent = 'Settings saved!';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
});