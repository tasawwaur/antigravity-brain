# Antigravity Brain - Full-Stack RAG Chat Hub
*(An interactive RAG dashboard connected to MongoDB Cloud)*

This directory contains the custom knowledge files database (totaling 26 files) and a Node.js/Express server connecting to MongoDB.

## How to Run:
1. **Install Dependencies:**
   Ensure you have Node.js installed, open terminal in this folder, and run:
   ```bash
   npm install
   ```
2. **Configure Database Connection String:**
   Rename or open the `.env` file in the project root directory:
   Replace the `MONGODB_URI` value with your actual MongoDB Atlas connection string.
3. **Launch Server:**
   Run the following command:
   ```bash
   npm start
   ```
4. **Open in Browser:**
   Open your browser and navigate to: `http://localhost:3000`

## Features:
* **Active Memory Controller:** Toggle which files are loaded into active context memory using the sidebar.
* **MongoDB Chat Database:** Saves and retrieves chat history directly to/from MongoDB Cloud.
* **Instant Keyword Semantic Retrieval:** A local client-side search indexing engine answers queries instantly.
* **Gemini API Integration:** Add your own Gemini API Key at the top of the chat panel to unlock live chat generation grounded by your markdown files context!
