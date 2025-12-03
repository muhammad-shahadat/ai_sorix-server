const createError = require("http-errors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const axios = require("axios");


const { successResponse } = require("./responseController");
const pool = require("../../config/db");
const { geminiApiKey } = require("../secret");


const handleGetChats = async (req, res, next) => {
    try {
        const userId = req.user.id; // passport JWT থেকে আসবে

        const result = await pool.query(
            `
            SELECT 
                c.id,
                c.title,
                c.default_model_id,
                m.slug AS default_model_slug,
                m.display_name AS default_model_name,
                c.total_messages,
                c.total_tokens_used,
                c.last_message_at,
                c.created_at
            FROM chats c
            LEFT JOIN models m ON c.default_model_id = m.id
            WHERE c.user_id = $1 
              AND c._deleted = false
            ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
            `,
            [userId]
        );

        return successResponse(res, {
            statusCode: 200,
            message: "User chats fetched successfully",
            payload: result.rows
        });
    } catch (err) {
        next(err);
    }
};


const handleCreateChat = async (req, res, next) => {
    try {
        const userId = req.user.id; // JWT থেকে আসবে

        // ফ্রন্টএন্ড থেকে আসতে পারে (অপশনাল)
        const { title, default_model_slug, system_prompt } = req.body;

        // যদি model_slug না দেয়, তাহলে ডিফল্ট মডেল হিসেবে Gemini বা GPT-4o নিবে
        let modelId = null;

        if (default_model_slug) {
            const modelResult = await pool.query(
                `SELECT id FROM models WHERE slug = $1 AND is_active = true`,
                [default_model_slug]
            );
            if (modelResult.rows.length === 0) {
                return next(createError(400, "Invalid or inactive model slug"));
            }
            modelId = modelResult.rows[0].id;
        } else {
            // ডিফল্ট মডেল: Gemini 2.0 Flash (তোর টেবিলে যেটা আছে)
            const defaultModel = await pool.query(
                `SELECT id FROM models WHERE slug = 'gemini-2.0-flash' AND is_active = true`
            );
            modelId = defaultModel.rows[0]?.id || 1; // ফলব্যাক
        }

        // টাইটেল না দিলে ডিফল্ট দিবে
        const chatTitle = title?.trim() || "নতুন চ্যাট";

        const result = await pool.query(
            `
            INSERT INTO chats (
                user_id, 
                title, 
                system_prompt, 
                default_model_id
            ) VALUES ($1, $2, $3, $4)
            RETURNING 
                id, title, default_model_id, created_at
            `,
            [userId, chatTitle, system_prompt || null, modelId]
        );

        const newChat = result.rows[0];

        // মডেলের নাম + স্লাগ যোগ করে দিচ্ছি (ফ্রন্টএন্ডের জন্য সুবিধা)
        const modelInfo = await pool.query(
            `SELECT slug, display_name FROM models WHERE id = $1`,
            [newChat.default_model_id]
        );

        const responsePayload = {
            ...newChat,
            default_model_slug: modelInfo.rows[0].slug,
            default_model_name: modelInfo.rows[0].display_name
        };

        return successResponse(res, {
            statusCode: 201,
            message: "Chat created successfully",
            payload: responsePayload
        });

    } catch (err) {
        // ডুপ্লিকেট বা অন্য এরর হলে
        if (err.code === "23505") {
            return next(createError(409, "Chat already exists"));
        }
        next(err);
    }
};

const handleGetChatById = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const chatId = req.params.id;

        // চ্যাটটা আছে কি না + ইউজারের কি না চেক
        const chatResult = await pool.query(
            `
            SELECT 
                c.id,
                c.title,
                c.system_prompt,
                c.default_model_id,
                m.slug AS default_model_slug,
                m.display_name AS default_model_name,
                c.total_messages,
                c.total_tokens_used,
                c.estimated_cost_cents,
                c.created_at,
                c.last_message_at
            FROM chats c
            LEFT JOIN models m ON c.default_model_id = m.id
            WHERE c.id = $1 
              AND c.user_id = $2 
              AND c._deleted = false
            `,
            [chatId, userId]
        );

        if (chatResult.rows.length === 0) {
            return next(createError(404, "Chat not found or access denied"));
        }

        const chat = chatResult.rows[0];

        // এই চ্যাটের সব মেসেজ নিয়ে আসা (chronological order)
        const messagesResult = await pool.query(
            `
            SELECT 
                id,
                role,
                content,
                model_slug,
                tokens_used,
                created_at
            FROM messages 
            WHERE chat_id = $1 
            ORDER BY created_at ASC
            `,
            [chatId]
        );

        const responsePayload = {
            ...chat,
            messages: messagesResult.rows
        };

        return successResponse(res, {
            statusCode: 200,
            message: "Chat and messages fetched successfully",
            payload: responsePayload
        });

    } catch (err) {
        next(err);
    }
};


const handleUpdateChat = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const chatId = req.params.id;

        const { title, default_model_slug, is_archived } = req.body || {};

        // কিছুই পাঠানো হয়নি কি না চেক
        if (!title && !default_model_slug && is_archived === undefined) {
            return next(createError(400, "Nothing to update. Provide title, default_model_slug or is_archived"));
        }

        // চ্যাটটা ইউজারের কি না চেক
        const chatCheck = await pool.query(
            `SELECT id, user_id, default_model_id FROM chats WHERE id = $1 AND _deleted = false`,
            [chatId]
        );

        if (chatCheck.rows.length === 0) {
            return next(createError(404, "Chat not found"));
        }
        if (chatCheck.rows[0].user_id !== userId) {
            return next(createError(403, "You don't own this chat"));
        }

        // মডেল স্লাগ থাকলে আইডি বের করি
        let newModelId = null;
        if (default_model_slug) {
            const modelResult = await pool.query(
                `SELECT id FROM models WHERE slug = $1 AND is_active = true`,
                [default_model_slug]
            );
            if (modelResult.rows.length === 0) {
                return next(createError(400, "Invalid or inactive model"));
            }
            newModelId = modelResult.rows[0].id;
        }

        // ডাইনামিক আপডেট কোয়েরি
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (title !== undefined && title !== null) {
            updates.push(`title = $${paramIndex++}`);
            values.push(title.trim() || "নতুন চ্যাট");
        }
        if (newModelId !== null) {
            updates.push(`default_model_id = $${paramIndex++}`);
            values.push(newModelId);
        }
        if (is_archived !== undefined) {
            updates.push(`is_archived = $${paramIndex++}`);
            values.push(!!is_archived); // boolean হিসেবে সেভ
        }

        // সবসময় updated_at আপডেট হবে
        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        // WHERE এর জন্য chatId আর userId (শেষে যোগ করছি)
        values.push(chatId);  // এটা হবে $paramIndex
        values.push(userId);  // এটা হবে $paramIndex + 1

        const query = `
            UPDATE chats 
            SET ${updates.join(", ")}
            WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
            RETURNING id, title, is_archived, default_model_id, updated_at
        `;

        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            return next(createError(500, "Failed to update chat"));
        }

        const updatedChat = result.rows[0];

        // মডেলের নাম + স্লাগ যোগ করা
        const modelInfo = await pool.query(
            `SELECT slug AS default_model_slug, display_name AS default_model_name 
             FROM models WHERE id = $1`,
            [updatedChat.default_model_id]
        );

        const payload = {
            ...updatedChat,
            default_model_slug: modelInfo.rows[0].default_model_slug,
            default_model_name: modelInfo.rows[0].default_model_name
        };

        return successResponse(res, {
            statusCode: 200,
            message: "Chat updated successfully",
            payload
        });

    } catch (err) {
        next(err);
    }
};

const handleDeleteChat = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const chatId = req.params.id;

        // চ্যাটটা ইউজারের কি না চেক করি
        const chatCheck = await pool.query(
            `SELECT id, user_id, _deleted FROM chats WHERE id = $1`,
            [chatId]
        );

        if (chatCheck.rows.length === 0) {
            return next(createError(404, "Chat not found"));
        }

        const chat = chatCheck.rows[0];

        if (chat.user_id !== userId) {
            return next(createError(403, "You are not allowed to delete this chat"));
        }

        // যদি ইতিমধ্যে ডিলিট করা থাকে
        if (chat._deleted === true) {
            return next(createError(400, "Chat already deleted"));
        }

        // সফট ডিলিট করি
        const result = await pool.query(
            `
            UPDATE chats 
            SET 
                _deleted = true,
                deleted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2
            RETURNING id, title, _deleted, deleted_at
            `,
            [chatId, userId]
        );

        return successResponse(res, {
            statusCode: 200,
            message: "Chat deleted successfully (soft delete)",
            payload: result.rows[0]
        });

    } catch (err) {
        next(err);
    }
};


const handleRegenerateTitle = async (req, res, next) => {

    try {
        const userId = req.user.id;
        const chatId = req.params.id;

        // চ্যাট চেক + মালিকানা চেক
        const chatResult = await pool.query(
            `SELECT id, user_id, default_model_id FROM chats WHERE id = $1 AND _deleted = false`,
            [chatId]
        );

        if (chatResult.rows.length === 0) {
            return next(createError(404, "Chat not found"));
        }
        if (chatResult.rows[0].user_id !== userId) {
            return next(createError(403, "Access denied"));
        }

        const defaultModelId = chatResult.rows[0].default_model_id;

        // চ্যাটের প্রথম ১৫টা মেসেজ নিব (টাইটেল বানানোর জন্য)
        const messagesResult = await pool.query(
            `SELECT role, content FROM messages WHERE chat_id = $1 ORDER BY created_at ASC LIMIT 15`,
            [chatId]
        );

        if (messagesResult.rows.length === 0) {
            return next(createError(400, "No messages to generate title"));
        }

        const messagesText = messagesResult.rows
            .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n");

        // ভাষা ডিটেক্ট করি (ইউজার কোন ভাষায় লিখেছে)
        const firstUserMsg = messagesResult.rows.find(m => m.role === "user")?.content || "";
        const hasBangla = /[\u0980-\u09FF]/.test(firstUserMsg);
        const hasEnglish = /[a-zA-Z]/.test(firstUserMsg);

        let languageInstruction = "বাংলায়";
        if (hasEnglish && !hasBangla) {
            languageInstruction = "ইংরেজিতে";
        } else if (hasEnglish && hasBangla) {
            languageInstruction = "যে ভাষায় বেশি লেখা হয়েছে সেই ভাষায় (বাংলা বা ইংরেজি)";
        }

        // সুপার ক্লিন প্রম্পট — Gemini, DeepSeek, GPT-4o সবাই বুঝবে
        const prompt = `তুমি একজন প্রফেশনাল চ্যাট টাইটেল জেনারেটর। 
        এই চ্যাটের বিষয়বস্তু দেখে একটা খুব সংক্ষিপ্ত, আকর্ষণীয় এবং মানানসই টাইটেল দাও।

        নিয়ম:
        - শুধু টাইটেল দিবে, কোনো ব্যাখ্যা/কোট/ইমোজি/মার্কডাউন দিবে না।
        - সর্বোচ্চ ৬০ অক্ষর।
        - টাইটেল ${languageInstruction} হতে হবে।

        চ্যাট:
        ${messagesText}

        টাইটেল:`;

        // মডেলের স্লাগ বের করি
        const modelResult = await pool.query(
            `SELECT slug FROM models WHERE id = $1`,
            [defaultModelId]
        );
        const modelSlug = modelResult.rows[0]?.slug || "gemini-2.0-flash";

        // প্রক্সি URL ঠিক করি — Gemini, DeepSeek, OpenAI সবাই চলবে
        let proxyUrl = "http://localhost:5000/api/proxy/openai/chat"; // ডিফল্ট

        if (modelSlug.includes("gemini")) {
            proxyUrl = "http://localhost:5000/api/proxy/gemini/text";
        } else if (modelSlug.includes("deepseek")) {
            proxyUrl = "http://localhost:5000/api/proxy/deepseek/chat";
        }
        // GPT-4o হলে openai/chat থাকবে

        // AI কে কল করি
        const aiResponse = await fetch(proxyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 60
            })
        });

        const aiData = await aiResponse.json();

        if (!aiResponse.ok || !aiData.choices?.[0]?.message?.content) {
            return next(createError(502, "Failed to generate title from AI"));
        }

        let newTitle = aiData.choices[0].message.content.trim();
        newTitle = newTitle.replace(/['"“”]/g, "").substring(0, 100);

        // ডাটাবেসে টাইটেল আপডেট
        const updateResult = await pool.query(
            `UPDATE chats 
             SET title = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2 AND user_id = $3 
             RETURNING id, title, updated_at`,
            [newTitle || "নতুন চ্যাট", chatId, userId]
        );

        return successResponse(res, {
            statusCode: 200,
            message: "Title regenerated successfully",
            payload: {
                id: updateResult.rows[0].id,
                title: updateResult.rows[0].title,
                updated_at: updateResult.rows[0].updated_at
            }
        });

    } catch (err) {
        next(err);
    }
};


const handleSendMessage = async (req, res, next) => {
    const chatId = req.params.id;
    const userId = req.user.id;
    const { content, attachments = [], model_slug } = req.body;

    // কন্টেন্ট না থাকলেও শুধু ফাইল থাকলে চলবে
    if ((!content || content.trim() === "") && attachments.length === 0) {
        return next(createError(400, "Message content or attachment is required"));
    }

    const stream = req.query.stream !== "false";

    try {
        // চ্যাট + ডিফল্ট মডেল চেক
        const chatResult = await pool.query(
            `SELECT c.default_model_id, m.slug AS default_slug 
             FROM chats c 
             LEFT JOIN models m ON c.default_model_id = m.id 
             WHERE c.id = $1 AND c.user_id = $2 AND c._deleted = false`,
            [chatId, userId]
        );

        if (chatResult.rows.length === 0) {
            return next(createError(404, "Chat not found"));
        }

        let modelId = chatResult.rows[0].default_model_id;
        let finalModelSlug = chatResult.rows[0].default_slug || "gemini-1.5-flash";

        if (model_slug) {
            const custom = await pool.query(
                `SELECT id, slug FROM models WHERE slug = $1 AND is_active = true`,
                [model_slug]
            );
            if (custom.rows.length > 0) {
                modelId = custom.rows[0].id;
                finalModelSlug = custom.rows[0].slug;
            }
        }

        // ইউজার মেসেজ + attachments সেভ করা
        await pool.query(
            `INSERT INTO messages (chat_id, user_id, role, content, model_id, attachments)
             VALUES ($1, $2, 'user', $3, $4, $5)`,
            [
                chatId,
                userId,
                content?.trim() || null,
                modelId,
                attachments.length > 0 ? JSON.stringify(attachments) : null
            ]
        );

        await pool.query(`UPDATE chats SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1`, [chatId]);

        // Streaming headers
        if (stream) {
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.setHeader("Transfer-Encoding", "chunked");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
        }

        let fullResponse = "";
        let promptTokens = 0;
        let completionTokens = 0;

        // ==================== GEMINI (ছবি + PDF + DOCX সাপোর্ট) ====================
        if (finalModelSlug.includes("gemini")) {
            const genAI = new GoogleGenerativeAI(geminiApiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-2.0-flash"
            });

            const parts = [];

            if (content?.trim()) {
                parts.push(content.trim());
            }

            // এখানে fileUri দিয়ে URL পাঠানো হচ্ছে — Base64 না!
            if (attachments.length > 0) {
                attachments.forEach(att => {
                    parts.push({
                        fileData: {
                            fileUri: att.url,
                            mimeType: att.type || "application/octet-stream"
                        }
                    });
                });
            }

           

            if (parts.length === 0) {
                parts.push("এই ফাইলগুলো দেখে উত্তর দাও");
            }

            const result = await model.generateContentStream(parts);

            for await (const chunk of result.stream) {
                const text = chunk.text();
                fullResponse += text;
                if (stream) res.write(text);
            }

            const usage = result.response.usageMetadata;
            promptTokens = usage?.promptTokenCount || 0;
            completionTokens = usage?.candidatesTokenCount || 0;
        }

        // ==================== GPT-4o / GPT-4o-mini (Vision সাপোর্ট) ====================
        else if (finalModelSlug.includes("gpt") || finalModelSlug.includes("4o") || finalModelSlug.includes("o1")) {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

            const messages = [];

            if (attachments.length > 0 && finalModelSlug.includes("4o")) {
                const contentArray = [];

                if (content?.trim()) {
                    contentArray.push({ type: "text", text: content.trim() });
                }

                attachments.forEach(att => {
                    contentArray.push({
                        type: "image_url",
                        image_url: { url: att.url }
                    });
                });

                messages.push({ role: "user", content: contentArray });
            } else {
                messages.push({ role: "user", content: content?.trim() || "এই ফাইলগুলো দেখো" });
            }

            const result = await openai.chat.completions.create({
                model: finalModelSlug.includes("o1") ? "o1-preview" : "gpt-4o-mini",
                messages,
                stream: true
            });

            for await (const chunk of result) {
                const text = chunk.choices[0]?.delta?.content || "";
                fullResponse += text;
                if (stream) res.write(text);
            }
        }

        // ==================== অন্যান্য মডেল (Claude, Grok, Llama3, DeepSeek) ====================
        else {
            const response = await axios.post(
                `${process.env.PROXY_BASE_URL}/v1/chat/completions`,
                {
                    model: finalModelSlug,
                    messages: [{ role: "user", content: content?.trim() || "এই ফাইলগুলো দেখো" }],
                    stream: true
                },
                { responseType: "stream" }
            );

            response.data.pipe(res);

            response.data.on("data", (chunk) => {
                const lines = chunk.toString().split("\n");
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.replace("data: ", "").trim();
                        if (!data || data === "[DONE]") continue;
                        try {
                            const parsed = JSON.parse(data);
                            const text = parsed.choices[0]?.delta?.content || "";
                            fullResponse += text;
                        } catch (e) { }
                    }
                }
            });

            await new Promise(resolve => response.data.on("end", resolve));
        }

        // স্ট্রিমিং শেষ
        if (stream) res.end();
        else res.json({ success: true, payload: { content: fullResponse } });

        // Assistant মেসেজ সেভ
        await pool.query(
            `INSERT INTO messages (chat_id, user_id, role, content, model_id, tokens_used)
             VALUES ($1, $2, 'assistant', $3, $4, $5)`,
            [chatId, userId, fullResponse, modelId, completionTokens || 0]
        );

        // টোকেন + খরচ আপডেট
        await pool.query(
            `UPDATE chats 
             SET total_tokens_used = total_tokens_used + $1,
                 estimated_cost_cents = estimated_cost_cents + $2
             WHERE id = $3`,
            [promptTokens + completionTokens, Math.round((completionTokens || 0) * 0.02), chatId]
        );

    } catch (err) {
        console.error("SendMessage Error:", err.message);
        if (!res.headersSent) {
            next(createError(500, err.message || "Failed to send message"));
        }
    }
};

const handleGetChatMessages = async (req, res, next) => {
    const chatId = req.params.id;
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before ? parseInt(req.query.before) : null; // pagination cursor

    try {
        // ১. চ্যাটটা ইউজারের কিনা চেক কর
        const chatCheck = await pool.query(
            `SELECT id, user_id, _deleted FROM chats WHERE id = $1`,
            [chatId]
        );

        if (chatCheck.rows.length === 0) {
            return next(createError(404, "Chat not found"));
        }

        const chat = chatCheck.rows[0];

        if (chat._deleted) {
            return next(createError(410, "Chat has been deleted"));
        }

        if (chat.user_id !== userId) {
            return next(createError(403, "You don't have access to this chat"));
        }

        // ২. মেসেজগুলো নিয়ে আয় (model info সহ)
        let query = `
            SELECT 
                m.id,
                m.role,
                m.content,
                m.tokens_used,
                m.cost_cents,
                m.attachments,
                m.is_edited,
                m.created_at,
                mdl.slug AS model_slug,
                mdl.display_name AS model_name,
                mdl.provider AS model_provider
            FROM messages m
            LEFT JOIN models mdl ON m.model_id = mdl.id
            WHERE m.chat_id = $1 AND m.is_deleted = false
        `;

        const params = [chatId];
        let paramIndex = 2;

        if (before) {
            query += ` AND m.id < $${paramIndex}`;
            params.push(before);
            paramIndex++;
        }

        query += ` ORDER BY m.created_at DESC`;
        query += ` LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await pool.query(query, params);

        // যদি আরো মেসেজ থাকে (hasMore)
        const hasMore = result.rows.length === limit;

        // পুরানো থেকে নতুনের দিকে রিভার্স করব (UI এর জন্য)
        const messages = result.rows.reverse().map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            tokens_used: msg.tokens_used || 0,
            cost_cents: msg.cost_cents || 0,
            attachments: msg.attachments || null,
            is_edited: msg.is_edited,
            created_at: msg.created_at,
            model: msg.model_slug ? {
                slug: msg.model_slug,
                name: msg.model_name,
                provider: msg.model_provider
            } : null
        }));

        res.json({
            success: true,
            payload: {
                messages,
                hasMore,
                nextCursor: hasMore ? result.rows[result.rows.length - 1].id : null
            }
        });

    } catch (err) {
        console.error("GetChatMessages Error:", err.message);
        next(createError(500, "Failed to load messages"));
    }
};






module.exports = {
    handleGetChats,
    handleCreateChat,
    handleGetChatById,
    handleUpdateChat,
    handleDeleteChat,
    handleRegenerateTitle,
    handleSendMessage,
    handleGetChatMessages,
    
};