# Screen Area Translator

> **Note:** This project was developed with the assistance of AI for personal use.

A lightweight, feature-packed Chrome extension (Manifest V3) that lets you snip and select any region on your browser screen—webpages, comic/manga panels, videos, or PDFs—and instantly translates the text using your choice of cloud AI models or local LLMs.

---

## Key Features

* **Multi-Provider AI Support with Auto-Discovery:**
  * **Google Gemini API:** Dynamic model listing and failover across vision-capable Flash models.
  * **OpenAI:** Automatic model discovery (auto-selects available vision models like `gpt-4o-mini`) or custom model overrides.
  * **Anthropic Claude:** Automatic model discovery across vision models (like `claude-3-5-haiku` / `claude-3-5-sonnet`) or custom model overrides.
  * **Ollama (Local & Free):** Run 100% offline, private, and unlimited translations using local vision models (e.g., `llama3.2-vision`).
  * **Custom / OpenAI-Compatible Endpoints:** Connect seamlessly to **vLLM**, **LM Studio**, **OpenRouter**, or **Groq**.
* **Flexible Model Overrides & Auto-Indication:** Leave model fields blank to automatically use smart vision model defaults. The overlay card subtly displays the auto-selected model name **only** when running in auto mode.
* **On-the-Fly Language Switching:** Easily adjust the target language (e.g., English, Spanish, Japanese, formal, Gen Z, Pirate talk) directly from the overlay card.
* **Responsive & Resizable UI:** The floating translation popup scales intelligently to screen size and includes vertical scrolling with a manual drag-to-resize handle.
* **Quick Snipping Trigger:** Launch via customizable keyboard shortcut (`Command + Shift + X` on Mac / `Ctrl + Shift + X` on Windows) or right-click context menu.
* **Auto-Healing Content Script:** Automatically reconnects and injects scripts if tabs lose context after extension updates.

---

## Installation

Since this extension is built for personal use, you can load it directly into Google Chrome as an unpacked extension:

1. Clone or download this repository to your computer.
2. Ensure the folder is named **`screen-area-translator`**.
3. Open Google Chrome and navigate to `chrome://extensions/`.
4. Enable **Developer mode** using the toggle switch in the top-right corner.
5. Click **Load unpacked** in the top-left corner.
6. Select the `screen-area-translator` directory.

---

## Configuration

1. Right-click the extension icon in your Chrome toolbar (or click the extensions puzzle piece) and select **Options**.
2. Select your preferred **AI Provider**:
   * **Google Gemini API / OpenAI / Claude:** Enter your API key. Leave the model override blank to let the extension auto-select an available vision model.
   * **Ollama (Local):** Set your endpoint URL (e.g., `http://localhost:11434`) and local vision model (e.g., `llama3.2-vision`).
   * **Custom / vLLM:** Enter your local server base URL (e.g., `http://localhost:8000/v1`) and vision model ID.
3. Set your **Default Target Language / Style** (e.g., `English`).
4. Click **Save Settings**.

---

## How to Use

1. Navigate to any webpage, image, or video.
2. Trigger the snipping tool using either:
   * **Keyboard Shortcut:** `Command + Shift + X` (Mac) or `Ctrl + Shift + X` (Windows/Linux).
   * **Right-Click Menu:** Right-click anywhere on the page and click **Select Area to Translate**.
3. Click and drag a box around the text you want to translate.
4. The translated text will render inside a popup card at the bottom-right corner of your screen.
5. **Adjusting the Popup:**
   * If running on default settings, an *"Auto-selected model: [model-name]"* badge appears at the bottom.
   * Change the target language dynamically in the top bar input field.
   * Click and drag the bottom-right corner of the popup to resize it.
   * Scroll vertically within the card for long translation blocks.

---

## Keyboard Shortcuts

To change the trigger shortcut in Chrome:

1. Open `chrome://extensions/shortcuts`.
2. Find **Screen Area Translator**.
3. Click the pencil icon under **Trigger Screen Selection Snipping Tool** to assign a key combination.

---

## Project Structure

```text
screen-area-translator/
├── manifest.json      # Extension permissions, scripts, and shortcuts configuration
├── background.js     # Background service worker, model auto-discovery & API routing
├── content.js        # Snipping selection overlay & floating UI card
├── options.html      # Settings interface for API keys and endpoint settings
└── options.js        # Logic for saving and handling extension configuration