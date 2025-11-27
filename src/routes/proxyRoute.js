const express = require("express");


const {
    handleOpenAIProxy,
    handleGeminiProxy,
    handleDeepSeekProxy
} = require("../controllers/proxyController");



const router = express.Router();


// OpenAI (GPT-4o)
router.post("/openai/chat", handleOpenAIProxy);

// Google Gemini
router.post("/gemini/text", handleGeminiProxy);

// DeepSeek
router.post("/deepseek/chat", handleDeepSeekProxy);

module.exports = router;