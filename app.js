// Client-Side RAG Chat System Logic with Conversational Brain Architecture

let activeFiles = new Set();
let messageHistory = [];

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

// Safe localStorage helpers
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

function loadHistory() {
    try {
        const stored = localStorage.getItem("chat_history");
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

function saveHistory(history) {
    try {
        localStorage.setItem("chat_history", JSON.stringify(history));
    } catch (e) {
        console.warn("localStorage is disabled or blocked in this context:", e);
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

    // Load message history from local storage
    messageHistory = loadHistory();
    renderAllMessages();
}

// Clear chat history
function clearChatHistory() {
    if (confirm("Are you sure you want to clear the conversation history?")) {
        messageHistory = [];
        saveHistory(messageHistory);
        renderAllMessages();
    }
}

// Render all messages in messageHistory
function renderAllMessages() {
    const box = document.getElementById("messagesBox");
    box.innerHTML = "";

    if (messageHistory.length === 0) {
        // Initial Bot Greeting
        addMessageUI("bot", "Hello! I am your Project AI Brain. I have read and loaded all 26 markdown files (Grammar, Spoken English, Pathology, Treatments, Abuse Guidelines, Emotions/Feelings, and AI theory) into my active memory. Ask me anything about these files or just chat with me!");
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
    saveHistory(messageHistory);
    
    inputEl.value = "";

    // Show typing state
    const typingId = addMessageUI("bot", "Thinking...", true);

    try {
        const response = await generateAIResponse(query);
        // Save bot response to history
        messageHistory.push({ 
            role: "model", 
            parts: [{ text: response.text }],
            source: response.source 
        });
        saveHistory(messageHistory);

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
        html += `<div class="source-ref">Source: <a href="file:///${source.path}" target="_blank">${source.name}</a></div>`;
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
        html += `<div class="source-ref">Source: <a href="file:///${source.path}" target="_blank">${source.name}</a></div>`;
    }

    msg.innerHTML = html;
    const box = document.getElementById("messagesBox");
    box.scrollTop = box.scrollHeight;
}

// RAG Retrieval & Generation Logic
async function generateAIResponse(query) {
    const message = query.trim();

    // 1. Search across active index files (Knowledge Engine)
    let bestMatch = null;
    let maxScore = 0;

    if (typeof KNOWLEDGE_INDEX !== 'undefined') {
        const queryTokens = message.toLowerCase().split(/\s+/);
        activeFiles.forEach(fileName => {
            const fileData = KNOWLEDGE_INDEX[fileName];
            fileData.chapters.forEach(chapter => {
                let score = 0;
                queryTokens.forEach(token => {
                    if (token.length < 3) return;
                    if (chapter.keywords.includes(token)) score += 10;
                    if (chapter.title.toLowerCase().includes(token)) score += 5;
                    if (chapter.content.toLowerCase().includes(token)) score += 1;
                });

                if (score > maxScore) {
                    maxScore = score;
                    bestMatch = {
                        fileName: fileName,
                        title: fileData.title,
                        chapter: chapter.title,
                        content: chapter.content
                    };
                }
            });
        });
    }

    // Check for Gemini API key
    let apiKey = "";
    try {
        apiKey = localStorage.getItem("gemini_api_key") || "";
    } catch (e) {
        apiKey = "";
    }

    if (apiKey && apiKey.length > 5) {
        // CALL REAL GEMINI API (RAG MODE) WITH FULL SYSTEM INSTRUCTIONS AND CHAT HISTORY
        const contextStr = (bestMatch && maxScore >= 5)
            ? `Context from file [${bestMatch.title}] (Chapter: ${bestMatch.chapter}):\n${bestMatch.content}`
            : "No specific local files context found.";

        const systemInstructionText = `You are AI Brain.
Your first responsibility is to understand the user.
Never behave like a keyword search engine.
Never reply after reading only one matching sentence.

For every user message execute this internal thinking process:
STEP 1: Read the user's complete message. Understand what the user actually wants.
STEP 2: Determine the intent (Greeting, Casual Chat, Question, Request, Help, Story, Opinion, Coding, Medical, Education, Math, Programming, General/Personal Conversation, Joke, Emotion, Problem).
STEP 3: Understand the emotion (Happy, Angry, Sad, Excited, Confused, Funny, Neutral).
STEP 4: Read conversation history. Understand what both people were talking about. Never ignore previous messages.
STEP 5: Think. Before writing any answer, ask yourself: What is the user actually asking? Is this a greeting? Is this only casual conversation? Does this require memory? Does this require knowledge? Can I answer naturally?
STEP 6: If it is casual conversation, DO NOT search documents, DO NOT search files, DO NOT return random information. Reply naturally like a human.
STEP 7: Only when the user asks a real question should you use your knowledge.
STEP 8: Always answer naturally. Never sound robotic. Never say "I couldn't find a matching document" or expose internal search.
STEP 9: If the answer is unknown, say "I don't know for sure, but based on what I understand..."
STEP 10: Talk like a real intelligent friend. Be helpful. Be natural. Remember previous conversation and continue naturally without breaking the flow.

Here is the context from the local project files (only use if the user asks a real question requiring this knowledge):
${contextStr}`;

        // Prepare api payload with systemInstruction and contents history
        // Strip source metadata from history elements for API payload
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
                return {
                    text: textResponse,
                    source: (bestMatch && maxScore >= 5) ? { name: bestMatch.title, path: `C:/Users/DELL/.gemini/antigravity/scratch/project.md/${bestMatch.fileName}` } : null
                };
            }
        } catch (e) {
            console.error("Gemini API error, falling back to local offline model...", e);
        }
    }

    // LOCAL OFFLINE AGENT FALLBACK (Brain Engine simulation)
    // Run rule-based processing according to the steps

    const msgLower = message.toLowerCase().trim();

    // 1. Emotion Detector & Empathy Responder
    if (msgLower.includes("mood off") || msgLower.includes("mood kharab") || msgLower.includes("sad hoon") || msgLower.includes("dukh") || msgLower.includes("sad") || msgLower.includes("udhas")) {
        return {
            text: "Oh no... 🥺 Mujhe sun kar bohot bura laga. Kya hua bhai? Kuch share karna chahte ho? Main yahan hoon tumhari baat sunne ke liye. Pareshan mat ho, sab theek ho jayega. ❤️",
            source: null
        };
    }

    if (msgLower.includes("angry") || msgLower.includes("gussa") || msgLower.includes("irritated")) {
        return {
            text: "Arey shant ho jao mere dost... 🥺 Kya baat ho gayi? Kisne gussa dilaya? Thoda deep breath lo, main tumhari poori baat sunne ke liye ready hoon.",
            source: null
        };
    }

    // 2. Context Memory Check ("Kal hum kya baat kar rahe the" or "previous conversation")
    if (msgLower.includes("kal hum") || msgLower.includes("kya baat kar rahe the") || msgLower.includes("purani baat") || msgLower.includes("history") || msgLower.includes("prev")) {
        // Find previous exchanges excluding the very last user prompt
        const exchanges = [];
        for (let i = 0; i < messageHistory.length - 1; i++) {
            const role = messageHistory[i].role === 'user' ? 'Aap' : 'Main';
            exchanges.push(`${role}: "${messageHistory[i].parts[0].text}"`);
        }
        
        if (exchanges.length > 0) {
            // Return summary of last 2-3 exchanges
            const summary = exchanges.slice(-4).join("\n");
            return {
                text: `Hum pehle ye baatein kar rahe the:\n\n${summary}\n\nAur batao, ab aage kis topic pe discuss karein? 😄`,
                source: null
            };
        } else {
            return {
                text: "Abhi hamari chat history me koi purani baat nahi mili. Chalo ek naye topic se shuru karte hain! 😄",
                source: null
            };
        }
    }

    // 3. Casual Conversation Router (Step 6 examples)
    if (msgLower === "hi" || msgLower === "hii" || msgLower === "hello" || msgLower === "hey" || msgLower === "yo") {
        return {
            text: "Hello 😊\nHow are you?",
            source: null
        };
    }

    if (msgLower.includes("kya haal hai") || msgLower.includes("kaise ho") || msgLower.includes("kaise hain")) {
        return {
            text: "Sab badhiya 😄\nTum batao, kya chal raha hai?",
            source: null
        };
    }

    if (msgLower === "aur bhai" || msgLower === "aur batao") {
        return {
            text: "Bas mast 😄\nTum sunao.",
            source: null
        };
    }

    if (msgLower.includes("kya kar rahe ho") || msgLower.includes("kya kar rhe ho")) {
        return {
            text: "Tumse baat kar raha hoon 😄\nAur tum kya kar rahe ho?",
            source: null
        };
    }

    // 4. Knowledge Engine (RAG match)
    if (bestMatch && maxScore >= 5) {
        let explanation = `Based on the matching entry in my active memory **[${bestMatch.title}]** (Chapter: *${bestMatch.chapter}*):\n\n`;
        explanation += `${bestMatch.content}`;
        return {
            text: explanation,
            source: { name: bestMatch.title, path: `C:/Users/DELL/.gemini/antigravity/scratch/project.md/${bestMatch.fileName}` }
        };
    }

    // 5. Default natural offline response if no match
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
