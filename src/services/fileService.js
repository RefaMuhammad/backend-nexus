const RecentFile = require("../models/RecentFile");

/**
 * Records or updates a file access entry for a user
 * @param {string} userId - User ID who accessed the file
 * @param {string} fileId - File ID being accessed
 * @param {string} projectId - Project ID associated with the file
 */
const recordFileAccess = async (userId, fileId, projectId) => {
  try {
    await RecentFile.findOneAndUpdate(
      { createdBy: userId, fileId },
      {
        projectId,
        accessedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("[RECORD_FILE_ACCESS_ERROR]:", error);
  }
};

module.exports = {
  recordFileAccess,
};
