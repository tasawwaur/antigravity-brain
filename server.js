const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// MongoDB Connection with Graceful Fallback
let isConnected = false;
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI && MONGODB_URI.length > 10) {
    mongoose.connect(MONGODB_URI)
        .then(() => {
            console.log('Successfully connected to MongoDB Cloud Database! 🎉');
            isConnected = true;
        })
        .catch(err => {
            console.error('MongoDB Connection Error! Falling back to in-memory storage.', err);
        });
} else {
    console.log('No MONGODB_URI provided in .env. Running server with local in-memory fallback. ⚠️');
}

// In-Memory Fallback Database
let memoryChatHistory = [];

// Mongoose Schema & Model definition
const messageSchema = new mongoose.Schema({
    role: { type: String, required: true },
    parts: [{
        text: { type: String, required: true }
    }],
    source: {
        name: String,
        path: String
    },
    createdAt: { type: Date, default: Date.now }
});

const ChatMessage = mongoose.model('ChatMessage', messageSchema);

// API Endpoints

// 1. Fetch Chat History
app.get('/api/history', async (req, res) => {
    try {
        if (isConnected) {
            const dbHistory = await ChatMessage.find().sort({ createdAt: 1 });
            return res.json({ success: true, history: dbHistory });
        } else {
            return res.json({ success: true, history: memoryChatHistory, fallback: true });
        }
    } catch (err) {
        console.error('Error fetching chat history:', err);
        res.status(500).json({ success: false, error: 'Database read failed' });
    }
});

// 2. Save Message to Database
app.post('/api/message', async (req, res) => {
    const { role, parts, source } = req.body;
    if (!role || !parts || !parts[0] || !parts[0].text) {
        return res.status(400).json({ success: false, error: 'Invalid message structure' });
    }

    try {
        if (isConnected) {
            const newMessage = new ChatMessage({ role, parts, source });
            await newMessage.save();
            return res.json({ success: true, message: newMessage });
        } else {
            const memMessage = { role, parts, source, createdAt: new Date() };
            memoryChatHistory.push(memMessage);
            return res.json({ success: true, message: memMessage, fallback: true });
        }
    } catch (err) {
        console.error('Error saving chat message:', err);
        res.status(500).json({ success: false, error: 'Database save failed' });
    }
});

// 3. Clear Chat History
app.post('/api/clear', async (req, res) => {
    try {
        if (isConnected) {
            await ChatMessage.deleteMany({});
            return res.json({ success: true, message: 'MongoDB chat history cleared successfully!' });
        } else {
            memoryChatHistory = [];
            return res.json({ success: true, message: 'In-memory fallback history cleared successfully!' });
        }
    } catch (err) {
        console.error('Error clearing chat history:', err);
        res.status(500).json({ success: false, error: 'Database wipe failed' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Antigravity Brain Server is running on http://localhost:${PORT}`);
    console.log(`   Frontend is live at http://localhost:${PORT}`);
    console.log(`=======================================================`);
});
