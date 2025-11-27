const createError = require("http-errors");
const { geminiApiKey } = require("../secret");

const handleOpenAIProxy = async (req, res, next) => {
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o",           // তোর models টেবিলে যেটা আছে
                ...req.body
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return next(createError(502, data.error?.message || "OpenAI API Error"));
        }

        return res.json(data);
    } catch (err) {
        next(createError(500, "OpenAI Proxy Failed: " + err.message));
    }
};

// const handleGeminiProxy = async (req, res, next) => {
//     try {
//         // তোর API Key দিয়ে টেস্ট করা URL
//         const response = await fetch(
//             `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
//             {
//                 method: "POST",
//                 headers: {
//                     "Content-Type": "application/json"
//                 },
//                 body: JSON.stringify({
//                     contents: req.body.messages.map(msg => ({
//                         role: msg.role === "assistant" ? "model" : "user",
//                         parts: [{ text: msg.content }]
//                     })),
//                     generationConfig: {
//                         temperature: req.body.temperature || 0.7,
//                         topP: 0.95,
//                         topK: 32,
//                         maxOutputTokens: 8192
//                     }
//                 })
//             }
//         );

//         const data = await response.json();

//         if (!response.ok) {
//             return next(createError(502, data.error?.message || "Gemini API Error"));
//         }

//         // OpenAI ফরম্যাটে কনভার্ট (তোর ফ্রন্টএন্ডের জন্য)
//         const formatted = {
//             choices: [{
//                 message: {
//                     role: "assistant",
//                     content: data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, no response generated."
//                 }
//             }],
//             usage: {
//                 prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
//                 completion_tokens: data.usageMetadata?.candidatesTokenCount?.[0]?.outputTokenCount || 0,
//                 total_tokens: data.usageMetadata?.totalTokenCount || 0
//             }
//         };

//         return res.json(formatted);

//     } catch (err) {
//         next(createError(500, "Gemini Proxy Failed: " + err.message));
//     }
// };

const handleGeminiProxy = async (req, res, next) => {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: req.body.messages.map(msg => ({
                        role: msg.role === "assistant" ? "model" : "user",
                        parts: [{ text: msg.content }]
                    })),
                    generationConfig: {
                        temperature: req.body.temperature || 0.7,
                        maxOutputTokens: 8192
                    }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return next(createError(502, data.error?.message || "Gemini API Error"));
        }

        // সঠিক টোকেন কাউন্ট + কন্টেন্ট
        const assistantText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        const formatted = {
            choices: [{
                message: {
                    role: "assistant",
                    content: assistantText
                }
            }],
            usage: {
                prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
                completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
                total_tokens: data.usageMetadata?.totalTokenCount || 0
            }
        };

        return res.json(formatted);

    } catch (err) {
        next(createError(500, "Gemini Proxy Failed: " + err.message));
    }
};


const handleDeepSeekProxy = async (req, res, next) => {
    try {
        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                ...req.body
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return next(createError(502, data.error?.message || "DeepSeek API Error"));
        }

        return res.json(data);
    } catch (err) {
        next(createError(500, "DeepSeek Proxy Failed: " + err.message));
    }
};

module.exports = {
    handleOpenAIProxy,
    handleGeminiProxy,
    handleDeepSeekProxy
};