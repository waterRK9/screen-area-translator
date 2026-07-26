chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'startSelection') {
    enableSnippingTool();
  } else if (request.action === 'showTranslation') {
    const container = getOrCreateOverlay();
    container.innerText = request.text;

    // Display model name only if auto-selected/default was used
    if (request.modelUsed) {
      const modelTag = document.createElement('div');
      modelTag.style.cssText = `
        font-size: 11px;
        color: #888;
        margin-top: 10px;
        padding-top: 6px;
        border-top: 1px dashed rgba(255, 255, 255, 0.15);
        font-style: italic;
      `;
      modelTag.innerText = `Auto-selected model: ${request.modelUsed}`;
      container.appendChild(modelTag);
    }
  } else if (request.action === 'showError') {
    const container = getOrCreateOverlay();
    container.innerHTML = `<span style="color: #ff6b6b;">${request.text}</span>`;
  }
});