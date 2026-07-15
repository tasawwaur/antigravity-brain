# Antigravity Brain - AI Chat Hub
*(An interactive client-side Retrieval-Augmented Generation (RAG) dashboard)*

This directory contains the custom knowledge files database (totaling 23 files) and a client-side web application interface.

## How to Run:
1. **Direct Launch:** Simply double-click on [index.html](file:///C:/Users/DELL/.gemini/antigravity/scratch/project.md/index.html) to open it in Google Chrome or Microsoft Edge.
2. **Local HTTP Server (Optional):** Open PowerShell, navigate to this directory, and run:
   ```bash
   python -m http.server 8000
   ```
   Then open `http://localhost:8000` in your web browser.

## Features:
* **Active Memory Controller:** Toggle which files are loaded into active context memory using the sidebar.
* **Instant Keyword Semantic Retrieval:** A local client-side search indexing engine answers queries instantly.
* **Gemini API Integration:** Add your own Gemini API Key at the top of the chat panel to unlock live chat generation grounded by your markdown files context!
