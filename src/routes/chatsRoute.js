const express = require("express");

const authRole = require("../middleware/authRole");
const passport = require("../passport");
const { handleGetChats, handleCreateChat, handleGetChatById, handleUpdateChat, handleDeleteChat, handleRegenerateTitle, handleSendMessage, handleGetChatMessages } = require("../controllers/chatsController");



const authenticate = passport.authenticate("jwt", { session: false });



const router = express.Router();


// GET /api/chats → ইউজারের সব চ্যাট লিস্ট (সাইডবারে দেখাবে)
router.get("/", 
    authenticate, 
    authRole("admin", "user"),
    handleGetChats

);

// POST /api/chats → নতুন চ্যাট তৈরি করা
router.post("/",
    authenticate, 
    authRole("admin", "user"),
    handleCreateChat

);

// GET /api/chats/:id → একটা চ্যাটের পুরো ডিটেইলস + সব মেসেজ
router.get("/:id",
    authenticate, 
    authRole("admin", "user"), 
    handleGetChatById
);

// PATCH /api/chats/:id → টাইটেল, মডেল বা আর্কাইভ স্ট্যাটাস চেঞ্জ
router.patch("/:id",
    authenticate,
    authRole("admin", "user"),
    handleUpdateChat

);

// DELETE /api/chats/:id → সফট ডিলিট (চ্যাট লুকিয়ে ফেলা)
router.delete("/:id", 
    authenticate,
    authRole("admin", "user"), 
    handleDeleteChat

);

// POST /api/chats/:id/regenerate-title → AI দিয়ে টাইটেল জেনারেট (Gemini, DeepSeek, GPT-4o সবাই চলবে)
router.post("/:id/regenerate-title",
    authenticate,
    authRole("admin", "user"), 
    handleRegenerateTitle
);


router.post("/:id/messages",
    authenticate,
    authRole("admin", "user"),
    handleSendMessage
);

//get chat-message history
router.get("/:id/messages",
    authenticate,
    authRole("admin", "user"),
    handleGetChatMessages,
);








module.exports = router;