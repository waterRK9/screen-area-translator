let isSelecting = false;
let startX, startY;
let selectionBox = null;

function getOrCreateOverlay() {
  let overlay = document.getElementById('screen-translator-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'screen-translator-overlay';
    overlay.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 340px;
      min-width: 220px;
      max-width: calc(100vw - 40px);
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      background-color: rgba(18, 18, 18, 0.95);
      color: #f1f1f1;
      padding: 14px;
      border-radius: 12px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.5);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      z-index: 999999;
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      resize: both;
      overflow: hidden;
      box-sizing: border-box;
    `;
    
    // Header container (Fixed top bar)
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      gap: 10px;
      flex-shrink: 0;
    `;

    const labelContainer = document.createElement('div');
    labelContainer.style.cssText = `display: flex; align-items: center; gap: 6px; width: 100%;`;

    const labelText = document.createElement('span');
    labelText.innerText = 'To:';
    labelText.style.cssText = `font-size: 12px; color: #aaa; font-weight: bold;`;

    const langInput = document.createElement('input');
    langInput.id = 'screen-lang-input';
    langInput.type = 'text';
    langInput.placeholder = 'e.g. English, Spanish';
    langInput.style.cssText = `
      background: #2a2a2a;
      color: #007bff;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 12px;
      font-weight: bold;
      width: 100%;
      outline: none;
    `;

    chrome.storage.sync.get(['targetLanguage'], (res) => {
      langInput.value = res.targetLanguage || 'English';
    });

    langInput.onchange = (e) => {
      const val = e.target.value.trim() || 'English';
      chrome.storage.sync.set({ targetLanguage: val });
    };

    labelContainer.appendChild(labelText);
    labelContainer.appendChild(langInput);

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #aaa;
      font-size: 16px;
      cursor: pointer;
      padding: 0 4px;
    `;
    closeBtn.onclick = () => overlay.style.display = 'none';
    
    header.appendChild(labelContainer);
    header.appendChild(closeBtn);

    // Scrollable content area
    const contentDiv = document.createElement('div');
    contentDiv.id = 'screen-translator-content';
    contentDiv.style.cssText = `
      white-space: pre-wrap;
      overflow-y: auto;
      flex-grow: 1;
      padding-right: 4px;
      word-break: break-word;
    `;
    
    overlay.appendChild(header);
    overlay.appendChild(contentDiv);
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  return document.getElementById('screen-translator-content');
}

function enableSnippingTool() {
  document.body.style.cursor = 'crosshair';

  const onMouseDown = (e) => {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;

    selectionBox = document.createElement('div');
    selectionBox.style.cssText = `
      position: fixed;
      border: 2px dashed #007bff;
      background: rgba(0, 123, 255, 0.2);
      z-index: 999998;
      pointer-events: none;
      left: ${startX}px;
      top: ${startY}px;
      width: 0px;
      height: 0px;
    `;
    document.body.appendChild(selectionBox);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e) => {
    if (!isSelecting) return;
    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);

    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
  };

  const onMouseUp = async (e) => {
    if (!isSelecting) return;
    isSelecting = false;
    document.body.style.cursor = 'default';

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    const rect = selectionBox.getBoundingClientRect();
    if (selectionBox) selectionBox.remove();

    if (rect.width < 10 || rect.height < 10) return;

    const container = getOrCreateOverlay();
    container.innerHTML = '<em>Translating selection...</em>';

    chrome.runtime.sendMessage({ action: "captureTab" }, async (response) => {
      if (!response || !response.dataUrl) {
        container.innerHTML = '<span style="color: #ff6b6b;">Screen capture failed.</span>';
        return;
      }

      const croppedBase64 = await cropImage(response.dataUrl, rect);

      chrome.runtime.sendMessage({
        action: "sendToGemini",
        base64Data: croppedBase64
      });
    });
  };

  document.addEventListener('mousedown', onMouseDown, { once: true });
}

function cropImage(dataUrl, rect) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      const canvas = document.createElement('canvas');
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        img,
        rect.left * dpr,
        rect.top * dpr,
        rect.width * dpr,
        rect.height * dpr,
        0,
        0,
        rect.width * dpr,
        rect.height * dpr
      );

      const base64Data = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
      resolve({ base64: base64Data, mimeType: 'image/jpeg' });
    };
    img.src = dataUrl;
  });
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'startSelection') {
    enableSnippingTool();
  } else if (request.action === 'showTranslation') {
    const container = getOrCreateOverlay();
    container.innerText = request.text;
  } else if (request.action === 'showError') {
    const container = getOrCreateOverlay();
    container.innerHTML = `<span style="color: #ff6b6b;">${request.text}</span>`;
  }
});