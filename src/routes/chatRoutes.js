const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { protect } = require("../middleware/authMiddleware");

// All routes here require authentication
router.use(protect);

// Project-scoped Chat Conversations
router.post("/projects/:projectId/conversations", chatController.createConversation);
router.get("/projects/:projectId/conversations", chatController.getConversations);

// Conversation detail, update, and delete
router.get("/conversations/:id", chatController.getConversationById);
router.patch("/conversations/:id", chatController.updateConversationTitle);
router.delete("/conversations/:id", chatController.deleteConversation);

module.exports = router;
