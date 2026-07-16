// Client-Side RAG Chat System Logic with Full-Stack MongoDB Backend Connection

let activeFiles = new Set();
let messageHistory = [];

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

// Safe localStorage helper for Gemini API Key (Client-side specific)
function getApiKey() {
    try {
        return localStorage.getItem("gemini_api_key") || "";
    } catch (e) {
        return "";
    }
}

function setApiKey(val) {
    try {
        localStorage.setItem("gemini_api_key", val);
    } catch (e) {
        console.warn("localStorage is disabled or blocked in this context:", e);
    }
}

// Backend API communication helpers
async function loadHistoryFromServer() {
    try {
        const res = await fetch('/api/history');
        const data = await res.json();
        if (data.success) {
            messageHistory = data.history;
        } else {
            messageHistory = [];
        }
    } catch (err) {
        console.error("Error loading chat history from MongoDB:", err);
        messageHistory = [];
    }
    renderAllMessages();
}

async function saveMessageToServer(role, text, source = null) {
    const msgObj = {
        role: role,
        parts: [{ text: text }],
        source: source
    };
    try {
        await fetch('/api/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msgObj)
        });
    } catch (err) {
        console.error("Error saving message to MongoDB database:", err);
    }
}

async function clearHistoryOnServer() {
    try {
        await fetch('/api/clear', { method: 'POST' });
    } catch (err) {
        console.error("Error clearing database history:", err);
    }
}

// Initialize files list & chat
function initApp() {
    const filesList = document.getElementById("filesList");
    filesList.innerHTML = "";

    // Load active files list from KNOWLEDGE_INDEX (loaded from index_data.js)
    if (typeof KNOWLEDGE_INDEX !== 'undefined') {
        Object.keys(KNOWLEDGE_INDEX).forEach(fileName => {
            const fileInfo = KNOWLEDGE_INDEX[fileName];
            activeFiles.add(fileName); // default loaded into memory

            const fileItem = document.createElement("div");
            fileItem.className = "file-item active";
            fileItem.id = `file-${fileName.replace(/\./g, '-')}`;
            fileItem.innerHTML = `
                <div class="file-title">${fileInfo.title}</div>
                <div class="file-meta">
                    <span>${fileInfo.chapterCount} Chapters</span>
                    <span class="memory-chip loaded" id="chip-${fileName.replace(/\./g, '-')}">Memory Active</span>
                </div>
            `;

            fileItem.addEventListener("click", () => {
                toggleFileMemory(fileName);
            });

            filesList.appendChild(fileItem);
        });
    }

    // Setup input listeners
    document.getElementById("sendBtn").addEventListener("click", sendMessage);
    document.getElementById("chatInput").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            sendMessage();
        }
    });

    // Clear Chat listener
    const clearBtn = document.getElementById("clearBtn");
    if (clearBtn) {
        clearBtn.addEventListener("click", clearChatHistory);
    }

    // Check if API Key is saved
    const savedKey = getApiKey();
    if (savedKey) {
        document.getElementById("apiKeyInput").value = savedKey;
    }

    document.getElementById("apiKeyInput").addEventListener("input", (e) => {
        const val = e.target.value.trim ? e.target.value.trim() : e.target.value;
        setApiKey(val);
    });

    // Load message history from MongoDB Cloud server
    loadHistoryFromServer();
}

// Clear chat history
async function clearChatHistory() {
    if (confirm("Are you sure you want to clear the conversation history? This will erase it from the MongoDB Cloud Database!")) {
        await clearHistoryOnServer();
        messageHistory = [];
        renderAllMessages();
    }
}

// Render all messages in messageHistory
function renderAllMessages() {
    const box = document.getElementById("messagesBox");
    box.innerHTML = "";

    if (messageHistory.length === 0) {
        // Initial Bot Greeting
        addMessageUI("bot", "Hello! I am your Project AI Brain. I am connected to a cloud MongoDB Database! All our conversation logs are securely stored there. Ask me anything about the loaded documents or just chat!");
    } else {
        messageHistory.forEach(msg => {
            const sender = msg.role === 'user' ? 'user' : 'bot';
            const text = msg.parts[0].text;
            addMessageUI(sender, text, false, msg.source);
        });
    }
}

// Toggle file in context memory
function toggleFileMemory(fileName) {
    const elementId = `file-${fileName.replace(/\./g, '-')}`;
    const chipId = `chip-${fileName.replace(/\./g, '-')}`;
    const fileItem = document.getElementById(elementId);
    const chip = document.getElementById(chipId);

    if (activeFiles.has(fileName)) {
        activeFiles.delete(fileName);
        fileItem.classList.remove("active");
        chip.textContent = "Offline";
        chip.className = "memory-chip unloaded";
    } else {
        activeFiles.add(fileName);
        fileItem.classList.add("active");
        chip.textContent = "Memory Active";
        chip.className = "memory-chip loaded";
    }
}

// Message handling
async function sendMessage() {
    const inputEl = document.getElementById("chatInput");
    const query = inputEl.value.trim();
    if (!query) return;

    // Display user message
    addMessageUI("user", query);
    messageHistory.push({ role: "user", parts: [{ text: query }] });
    await saveMessageToServer("user", query);
    
    inputEl.value = "";

    // Show typing state
    const typingId = addMessageUI("bot", "Thinking...", true);

    try {
        const response = await generateAIResponse(query);
        // Save bot response to server
        await saveMessageToServer("model", response.text, response.source);
        messageHistory.push({ 
            role: "model", 
            parts: [{ text: response.text }],
            source: response.source 
        });

        updateBotMessage(typingId, response.text, response.source);
    } catch (err) {
        console.error(err);
        updateBotMessage(typingId, "Error: Unable to parse query. Please check your network or API settings.");
    }
}

// Render message block to DOM
let messageCounter = 0;
function addMessageUI(sender, text, isTemp = false, source = null) {
    messageCounter++;
    const msgId = `msg-${Date.now()}-${messageCounter}`;
    const box = document.getElementById("messagesBox");
    
    const msg = document.createElement("div");
    msg.className = `message ${sender}`;
    msg.id = msgId;
    
    let html = `
        <div class="sender">${sender === 'user' ? 'You' : 'AI Brain'}</div>
        <div class="message-content">${formatMarkdown(text)}</div>
    `;

    if (source) {
        if (Array.isArray(source)) {
            html += `<div class="source-ref">Sources: `;
            source.forEach((src, idx) => {
                html += `${idx > 0 ? ', ' : ''}<a href="file:///${src.path}" target="_blank">📄 ${src.name}</a>`;
            });
            html += `</div>`;
        } else {
            html += `<div class="source-ref">Source: <a href="file:///${source.path}" target="_blank">${source.name}</a></div>`;
        }
    }

    msg.innerHTML = html;
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
    return msgId;
}

function updateBotMessage(msgId, text, source = null) {
    const msg = document.getElementById(msgId);
    if (!msg) return;

    let html = `
        <div class="sender">AI Brain</div>
        <div class="message-content">${formatMarkdown(text)}</div>
    `;

    if (source) {
        if (Array.isArray(source)) {
            html += `<div class="source-ref">Sources: `;
            source.forEach((src, idx) => {
                html += `${idx > 0 ? ', ' : ''}<a href="file:///${src.path}" target="_blank">📄 ${src.name}</a>`;
            });
            html += `</div>`;
        } else {
            html += `<div class="source-ref">Source: <a href="file:///${source.path}" target="_blank">${source.name}</a></div>`;
        }
    }

    msg.innerHTML = html;
    const box = document.getElementById("messagesBox");
    box.scrollTop = box.scrollHeight;
}

// RAG Retrieval & Generation Logic
async function generateAIResponse(query) {
    const message = query.trim();
    const msgLower = message.toLowerCase();

    // ==========================================
    // STEP 1-5: INTENT & EMOTION DETECTOR (Think first!)
    // ==========================================

    let isCasualChat = false;
    let casualReply = "";

    // A. Greetings / Hey (Checks common variations)
    const greetings = ["hi", "hii", "hiii", "hello", "hey", "yo", "namaste", "suno", "hey there"];
    if (greetings.includes(msgLower)) {
        isCasualChat = true;
        casualReply = "Hello 😊\nHow are you?";
    }

    // B. Casual Chat / "Kaise ho" / "Kya haal hai"
    const statusQueries = [
        "kya haal hai", "kya hal hai", "kaise ho", "kaise ho bhai", "kaise ho tum", "kaise hain", 
        "aap kaise ho", "sab thik", "sab badhiya", "kaisa chal raha hai"
    ];
    if (statusQueries.some(q => msgLower.includes(q)) || msgLower === "haal chaal") {
        isCasualChat = true;
        casualReply = "Sab badhiya 😄\nTum batao, kya chal raha hai?";
    }

    // C. "Kya kar rahe ho" / "Kya chal raha hai"
    const actionQueries = [
        "kya kar rahe ho", "kya kar rhe ho", "kyaa kr rhe ho", "kya kr rhe ho", 
        "kya kar rahe", "kya kar rhe", "kyaa kr rhe", "kya chal raha hai", "kya chal rha hai"
    ];
    if (actionQueries.some(q => msgLower.includes(q))) {
        isCasualChat = true;
        casualReply = "Tumse baat kar raha hoon 😄\nAur tum kya kar rahe ho?";
    }

    // D. "Aur batao" / "Aur bhai"
    if (msgLower === "aur batao" || msgLower === "aur sunao" || msgLower === "aur bhai" || msgLower === "aur batao bhai") {
        isCasualChat = true;
        casualReply = "Bas mast 😄\nTum sunao.";
    }

    // E. Emotion Detector (Sadness, Mood off)
    let hasEmpathyTrigger = false;
    let empathyReply = "";
    const sadKeywords = ["mood off", "mood kharab", "sad hoon", "dukh", "sad", "udhas", "depression", "pareshan"];
    if (sadKeywords.some(kw => msgLower.includes(kw))) {
        hasEmpathyTrigger = true;
        empathyReply = "Oh no... 🥺 Mujhe sun kar bohot bura laga. Kya hua bhai? Kuch share karna chahte ho? Main yahan hoon tumhari baat sunne ke liye. Pareshan mat ho, sab theek ho jayega. ❤️";
    }

    const angryKeywords = ["angry", "gussa", "irritated", "dimag kharab"];
    if (angryKeywords.some(kw => msgLower.includes(kw))) {
        hasEmpathyTrigger = true;
        empathyReply = "Arey shant ho jao mere dost... 🥺 Kya baat ho gayi? Kisne gussa dilaya? Thoda deep breath lo, main tumhari poori baat sunne ke liye ready hoon.";
    }

    // F. Context Memory Check ("Kal hum kya baat kar rahe the")
    let hasMemoryTrigger = false;
    let memoryReply = "";
    const memoryKeywords = ["kal hum", "kya baat kar rahe the", "purani baat", "history", "prev", "pehle kya"];
    if (memoryKeywords.some(kw => msgLower.includes(kw))) {
        hasMemoryTrigger = true;
        const exchanges = [];
        for (let i = 0; i < messageHistory.length - 1; i++) {
            const role = messageHistory[i].role === 'user' ? 'Aap' : 'Main';
            exchanges.push(`${role}: "${messageHistory[i].parts[0].text}"`);
        }
        if (exchanges.length > 0) {
            const summary = exchanges.slice(-4).join("\n");
            memoryReply = `Hum pehle ye baatein kar rahe the:\n\n${summary}\n\nAur batao, ab aage kis topic pe discuss karein? 😄`;
        } else {
            memoryReply = "Abhi hamari chat history me koi purani baat nahi mili. Chalo ek naye topic se shuru karte hain! 😄";
        }
    }

    // ==========================================
    // ROUTING ACCORDING TO THINKING ENGINE RULES
    // ==========================================

    // 1. Emotion triggers have highest priority (Empathy first)
    if (hasEmpathyTrigger) {
        return { text: empathyReply, source: null };
    }

    // 2. Memory triggers have second priority
    if (hasMemoryTrigger) {
        return { text: memoryReply, source: null };
    }

    // 3. Casual chat replies (Do NOT search files if it's casual chat)
    if (isCasualChat) {
        return { text: casualReply, source: null };
    }

    // 4. Knowledge Engine (Only run RAG if it's a real query requiring documents)
    let matches = [];

    if (typeof KNOWLEDGE_INDEX !== 'undefined') {
        const queryTokens = message.toLowerCase().split(/\s+/).filter(t => t.length >= 3);
        activeFiles.forEach(fileName => {
            const fileData = KNOWLEDGE_INDEX[fileName];
            fileData.chapters.forEach(chapter => {
                let score = 0;
                queryTokens.forEach(token => {
                    if (chapter.keywords.includes(token)) score += 12;
                    if (chapter.title.toLowerCase().includes(token)) score += 6;
                    if (chapter.content.toLowerCase().includes(token)) score += 2;
                });

                if (score > 0) {
                    matches.push({
                        score: score,
                        fileName: fileName,
                        fileTitle: fileData.title,
                        chapterTitle: chapter.title,
                        content: chapter.content
                    });
                }
            });
        });
    }

    // Sort matches descending by relevance score
    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, 4);
    const hasGoodMatch = topMatches.length > 0 && topMatches[0].score >= 8;

    // Check for Gemini API key
    let apiKey = "";
    try {
        apiKey = localStorage.getItem("gemini_api_key") || "";
    } catch (e) {
        apiKey = "";
    }

    if (apiKey && apiKey.length > 5) {
        // CALL REAL GEMINI API (RAG MODE) WITH FULL SYSTEM INSTRUCTIONS AND CHAT HISTORY
        const contextStr = hasGoodMatch
            ? topMatches.map((m, idx) => `[Document ${idx+1}] File: "${m.fileTitle}" (Chapter: "${m.chapterTitle}")\nContent:\n${m.content}`).join("\n\n---\n\n")
            : "No specific local files context found.";

        const systemInstructionText = `You are AI Brain.
Your first responsibility is to read the compiled local project files context below and answer the user's question directly based ONLY on this context.

DIRECTIONS:
1. Search all provided [Document X] sources, compare the translation files (English, Hindi, Hinglish), extract the exact meaning/grammatical rules/words, and provide the answer.
2. Be highly specific and concise. Directly answer what is asked. Do not guess or add unrelated general knowledge if the context provides the facts.
3. Be conversational and natural, utilizing the user's input language (Hindi, English, or Hinglish) to reply.
4. If the user asks a casual question (like "hi", "how are you", "kya kar rahe ho"), do not refer to the documents. Respond naturally as a helpful friend.
5. Never output meta-data, raw queries, or technical errors (such as "no matches found in active memory").

Here is the context from the local active memory files:
${contextStr}`;

        // Prepare api payload with systemInstruction and contents history
        const apiContents = messageHistory.map(item => ({
            role: item.role,
            parts: item.parts
        }));

        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: apiContents,
                    systemInstruction: {
                        parts: [{ text: systemInstructionText }]
                    }
                })
            });

            const data = await res.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                const textResponse = data.candidates[0].content.parts[0].text;
                
                // Deduplicate source file paths
                const uniqueSources = [];
                const seenFiles = new Set();
                topMatches.forEach(m => {
                    if (!seenFiles.has(m.fileName)) {
                        seenFiles.add(m.fileName);
                        uniqueSources.push({
                            name: m.fileTitle,
                            path: `C:/Users/DELL/.gemini/antigravity/scratch/project.md/${m.fileName}`
                        });
                    }
                });

                return {
                    text: textResponse,
                    source: hasGoodMatch ? uniqueSources : null
                };
            }
        } catch (e) {
            console.error("Gemini API error, falling back to local offline model...", e);
        }
    }

    // LOCAL OFFLINE AGENT FALLBACK (RAG Match - compile all matches)
    if (hasGoodMatch) {
        let explanation = `Based on the matching entries in my active memory:\n\n`;
        topMatches.forEach(m => {
            explanation += `📁 **[${m.fileTitle}]** (Chapter: *${m.chapterTitle}*):\n${m.content}\n\n---\n\n`;
        });

        const uniqueSources = [];
        const seenFiles = new Set();
        topMatches.forEach(m => {
            if (!seenFiles.has(m.fileName)) {
                seenFiles.add(m.fileName);
                uniqueSources.push({
                    name: m.fileTitle,
                    path: `C:/Users/DELL/.gemini/antigravity/scratch/project.md/${m.fileName}`
                });
            }
        });

        return {
            text: explanation,
            source: uniqueSources
        };
    }

    // 5. Default natural response if no match found
    return {
        text: "I don't know for sure, but based on what I understand, iske baare mein meri active local memory me specific documentation nahi mila. Agar aap kisi specific topic (jaise grammar, disease treatments, emotions) ke baare me pooch rahe hain, toh thoda detail me likhein! 😊",
        source: null
    };
}

// Simple Markdown Formatter
function formatMarkdown(text) {
    if (!text) return "";
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

