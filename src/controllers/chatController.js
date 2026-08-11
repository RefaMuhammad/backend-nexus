const ChatConversation = require("../models/ChatConversation");
const File = require("../models/File");

// Helper to extract user ID from req.user
const getUserId = (req) => {
  return req.user?.id || req.user?._id;
};

// a. Create Conversation (POST /api/projects/:projectId/conversations)
exports.createConversation = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title } = req.body;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthenticated user (Please include JWT token)",
      });
    }

    // Find all active files in the project to serve as the context (RAG)
    const activeFiles = await File.find({ projectId, status: "active" }).select("_id");
    const filesId = activeFiles.map((file) => file._id);

    const newConversation = new ChatConversation({
      projectId,
      title: title || "New Conversation",
      filesId,
      createdBy: userId,
    });

    const savedConversation = await newConversation.save();

    return res.status(201).json({
      success: true,
      message: "Conversation created successfully",
      data: savedConversation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create conversation",
      error: error.message,
    });
  }
};

// b. Get All Project Conversations (GET /api/projects/:projectId/conversations)
exports.getConversations = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthenticated user (Please include JWT token)",
      });
    }

    const conversations = await ChatConversation.find({
      projectId,
      createdBy: userId,
    })
      .populate("filesId", "fileName fileType")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Conversations retrieved successfully",
      data: conversations,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve conversations",
      error: error.message,
    });
  }
};

// c. Get Single Conversation Detail (GET /api/conversations/:id)
exports.getConversationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthenticated user (Please include JWT token)",
      });
    }

    const conversation = await ChatConversation.findOne({
      _id: id,
      createdBy: userId,
    }).populate("filesId", "fileName fileType");

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Conversation detail retrieved successfully",
      data: conversation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve conversation detail",
      error: error.message,
    });
  }
};

// d. Update Conversation Title (PATCH /api/conversations/:id)
exports.updateConversationTitle = async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthenticated user (Please include JWT token)",
      });
    }

    if (!title || typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Title is required and must be a valid string",
      });
    }

    const updatedConversation = await ChatConversation.findOneAndUpdate(
      { _id: id, createdBy: userId },
      { title: title.trim(), updatedBy: userId },
      { new: true }
    );

    if (!updatedConversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found or not owned by user",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Conversation title updated successfully",
      data: updatedConversation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update conversation title",
      error: error.message,
    });
  }
};

// e. Delete Conversation (DELETE /api/conversations/:id)
exports.deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthenticated user (Please include JWT token)",
      });
    }

    const deletedConversation = await ChatConversation.findOneAndDelete({
      _id: id,
      createdBy: userId,
    });

    if (!deletedConversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found or not owned by user",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Conversation deleted successfully",
      data: deletedConversation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete conversation",
      error: error.message,
    });
  }
};
