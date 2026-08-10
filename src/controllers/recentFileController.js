const RecentFile = require("../models/RecentFile");

exports.getRecentFiles = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Query recent files, limit to 15, sort by accessedAt desc
    const recentFiles = await RecentFile.find({ createdBy: userId })
      .sort({ accessedAt: -1 })
      .limit(15)
      .populate({
        path: "fileId",
        select: "fileName fileType sizeBytes status",
        match: { status: "active" }
      })
      .populate("projectId", "name");

    // Filter out entries where fileId is null (e.g. because file was trashed, deleted, or match condition failed)
    const filteredRecentFiles = recentFiles.filter(item => item.fileId !== null);

    return res.status(200).json({
      success: true,
      data: filteredRecentFiles
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
