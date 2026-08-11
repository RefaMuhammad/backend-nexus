const ChatConversation = require("../models/ChatConversation");

/**
 * Syncs a newly created file ID to all existing conversations within the same project.
 * Uses $addToSet to avoid duplicating the fileId in filesId array.
 * 
 * @param {string|mongoose.Types.ObjectId} projectId
 * @param {string|mongoose.Types.ObjectId} fileId
 * @returns {Promise<any>}
 */
const syncNewFileToConversations = async (projectId, fileId) => {
  try {
    const result = await ChatConversation.updateMany(
      { projectId },
      { $addToSet: { filesId: fileId } }
    );
    return result;
  } catch (error) {
    console.error("Error in syncNewFileToConversations service:", error);
    throw error;
  }
};

module.exports = {
  syncNewFileToConversations,
};
