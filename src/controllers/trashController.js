const File = require("../models/File");
const Folder = require("../models/Folder");
const Project = require("../models/Projects");

// 1. GET /api/trash (Protected) - [View & Filter Trash]
exports.viewTrash = async (req, res) => {  
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { projectId, fileType, search, sortBy } = req.query;

    // Fetch only projects the user has access to
    const userProjects = await Project.find({
      isDeleted: false,
      $or: [{ createdBy: userId }, { "members.userId": userId }]
    }).select("_id");
    const allowedProjectIds = userProjects.map(p => p._id);

    // If a specific projectId is requested, check if the user has access to it
    let targetProjectIds = allowedProjectIds;
    if (projectId) {
      if (!allowedProjectIds.some(id => id.toString() === projectId.toString())) {
        return res.status(403).json({ success: false, message: "Access denied to project" });
      }
      targetProjectIds = [projectId];
    }

    // Build filters for File and Folder
    const fileFilter = {
      projectId: { $in: targetProjectIds },
      status: "trash"
    };

    const folderFilter = {
      projectId: { $in: targetProjectIds },
      status: "trash"
    };

    // Apply search filter
    if (search) {
      fileFilter.fileName = { $regex: search, $options: "i" };
      folderFilter.name = { $regex: search, $options: "i" };
    }

    // Apply fileType filter (only applies to files, if folders are requested they won't match)
    if (fileType) {
      fileFilter.fileType = fileType;
    }

    // Apply sorting
    const sortOrder = sortBy === "deletedAt" || !sortBy ? -1 : (sortBy === "oldest" ? 1 : -1);
    const sortOption = { deletedAt: sortOrder };

    const files = await File.find(fileFilter).sort(sortOption).populate("createdBy", "name email");
    
    // Folders are only queried if no specific fileType is requested (since folders don't have fileType)
    let folders = [];
    if (!fileType) {
      folders = await Folder.find(folderFilter).sort(sortOption).populate("createdBy", "name email");
    }

    return res.status(200).json({
      success: true,
      data: {
        files,
        folders
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. PATCH /api/trash/restore (Protected) - [Restore Item / Bulk Restore]
exports.restoreTrash = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { fileIds = [], folderIds = [] } = req.body;

    // Fetch user projects to ensure they have access to restore
    const userProjects = await Project.find({
      isDeleted: false,
      $or: [{ createdBy: userId }, { "members.userId": userId }]
    }).select("_id");
    const allowedProjectIds = userProjects.map(p => p._id.toString());

    // Validate and restore files
    if (fileIds.length > 0) {
      const filesToRestore = await File.find({ _id: { $in: fileIds }, status: "trash" });
      const unauthorizedFiles = filesToRestore.filter(f => !allowedProjectIds.includes(f.projectId.toString()));
      
      if (unauthorizedFiles.length > 0) {
        return res.status(403).json({ success: false, message: "Access denied to one or more files" });
      }

      await File.updateMany(
        { _id: { $in: fileIds } },
        { status: "active", deletedAt: null }
      );
    }

    // Validate and restore folders
    if (folderIds.length > 0) {
      const foldersToRestore = await Folder.find({ _id: { $in: folderIds }, status: "trash" });
      const unauthorizedFolders = foldersToRestore.filter(f => !allowedProjectIds.includes(f.projectId.toString()));

      if (unauthorizedFolders.length > 0) {
        return res.status(403).json({ success: false, message: "Access denied to one or more folders" });
      }

      await Folder.updateMany(
        { _id: { $in: folderIds } },
        { status: "active", deletedAt: null }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Items restored successfully"
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. DELETE /api/trash/permanent (Protected) - [Permanent Purge / Bulk Delete]
exports.permanentDeleteTrash = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { fileIds = [], folderIds = [] } = req.body;

    // Fetch user projects to ensure they have access to delete
    const userProjects = await Project.find({
      isDeleted: false,
      $or: [{ createdBy: userId }, { "members.userId": userId }]
    }).select("_id");
    const allowedProjectIds = userProjects.map(p => p._id.toString());

    // Validate and permanently delete files
    if (fileIds.length > 0) {
      const filesToDelete = await File.find({ _id: { $in: fileIds }, status: "trash" });
      const unauthorizedFiles = filesToDelete.filter(f => !allowedProjectIds.includes(f.projectId.toString()));

      if (unauthorizedFiles.length > 0) {
        return res.status(403).json({ success: false, message: "Access denied to one or more files" });
      }

      await File.deleteMany({ _id: { $in: fileIds } });
    }

    // Validate and permanently delete folders
    if (folderIds.length > 0) {
      const foldersToDelete = await Folder.find({ _id: { $in: folderIds }, status: "trash" });
      const unauthorizedFolders = foldersToDelete.filter(f => !allowedProjectIds.includes(f.projectId.toString()));

      if (unauthorizedFolders.length > 0) {
        return res.status(403).json({ success: false, message: "Access denied to one or more folders" });
      }

      await Folder.deleteMany({ _id: { $in: folderIds } });
    }

    return res.status(200).json({
      success: true,
      message: "Items permanently deleted"
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
