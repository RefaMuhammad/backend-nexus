const File = require("../models/File");
const Project = require("../models/Projects");
const Folder = require("../models/Folder");

// Create / Upload File Metadata
exports.createFile = async (req, res) => {
  try {
    const {
      projectId,
      folderId,
      fileName,
      originalName,
      fileType,
      category,
      sizeBytes,
      fileUrl,
      version,
      previousVersionId,
    } = req.body;

    const createdBy = req.user?.id || req.user?._id || req.body.createdBy;

    if (!createdBy) {
      return res.status(401).json({
        message: "Pengguna tidak terautentikasi (Silakan sertakan Token JWT pada Header atau createdBy pada Body)",
      });
    }

    // Check project access
    const project = await Project.findOne({ _id: projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    const isMember = project.createdBy.toString() === createdBy || project.members.some(m => m.userId.toString() === createdBy);
    if (!isMember) {
      return res.status(403).json({ message: "Access denied to project" });
    }

    const newFile = new File({
      projectId,
      folderId: folderId || null,
      createdBy,
      fileName,
      originalName,
      fileType,
      category,
      sizeBytes,
      fileUrl,
      version: version || 1,
      previousVersionId: previousVersionId || null,
      status: "active",
    });

    const savedFile = await newFile.save();

    // Sync new file to existing conversations of the project
    try {
      const { syncNewFileToConversations } = require("../services/chatService");
      await syncNewFileToConversations(projectId, savedFile._id);
    } catch (syncError) {
      console.error("Failed to sync new file to conversations:", syncError.message);
    }

    return res.status(201).json({
      message: "File berhasil disimpan",
      data: savedFile,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create file metadata",
      error: error.message,
    });
  }
};

// Get List Files (Filtered by project, folder, status, category, search)
exports.getFiles = async (req, res) => {
  try {
    const {
      projectId,
      folderId,
      status = "active",
      category,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Only get files for projects the user has access to
    const userProjects = await Project.find({
      isDeleted: false,
      $or: [{ createdBy: userId }, { "members.userId": userId }]
    }).select("_id");
    const projectIds = userProjects.map(p => p._id);

    const filter = { status };

    if (projectId) {
      if (!projectIds.some(pId => pId.toString() === projectId.toString())) {
        return res.status(403).json({ message: "Access denied to project" });
      }
      filter.projectId = projectId;
    } else {
      filter.projectId = { $in: projectIds };
    }

    if (folderId !== undefined) {
      filter.folderId = folderId === "null" || folderId === "" ? null : folderId;
    }
    if (category) filter.category = category;
    if (search) {
      filter.fileName = { $regex: search, $options: "i" };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const files = await File.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name email");

    const total = await File.countDocuments(filter);

    return res.status(200).json({
      data: files,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retrieve the file list",
      error: error.message,
    });
  }
};

// Get Single File by ID
exports.getFileById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const file = await File.findById(id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("previousVersionId");

    if (!file || file.status === "deleted") {
      return res.status(404).json({ message: "File not found" });
    }

    const project = await Project.findOne({ _id: file.projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ message: "Associated project not found" });
    }
    const isMember = project.createdBy.toString() === userId || project.members.some(m => m.userId.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ message: "Access denied to file's project" });
    }

    return res.status(200).json({ data: file });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retrieve file details",
      error: error.message,
    });
  }
};

// Get Files by Project ID
exports.getFilesByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status = "active", category, search, page = 1, limit = 20 } = req.query;
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const project = await Project.findOne({ _id: projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    const isMember = project.createdBy.toString() === userId || project.members.some(m => m.userId.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ message: "Access denied to project" });
    }

    const filter = { projectId, status };
    if (category) filter.category = category;
    if (search) filter.fileName = { $regex: search, $options: "i" };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const files = await File.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name email");

    const total = await File.countDocuments(filter);

    return res.status(200).json({
      data: files,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retrieve files by project ID",
      error: error.message,
    });
  }
};

// Get Files by Folder ID
exports.getFilesByFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { status = "active", category, search, page = 1, limit = 20 } = req.query;
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Menangani kasus 'root' folder (folderId === 'null' atau 'root')
    const parsedFolderId = folderId === "null" || folderId === "root" ? null : folderId;

    const filter = { folderId: parsedFolderId, status };

    if (parsedFolderId) {
      const folder = await Folder.findById(parsedFolderId);
      if (!folder) return res.status(404).json({ message: "Folder not found" });
      const project = await Project.findOne({ _id: folder.projectId, isDeleted: false });
      if (!project) return res.status(404).json({ message: "Associated project not found" });
      const isMember = project.createdBy.toString() === userId || project.members.some(m => m.userId.toString() === userId);
      if (!isMember) return res.status(403).json({ message: "Access denied" });
      filter.projectId = folder.projectId;
    } else {
      // If folder is root, they MUST pass projectId in query to identify which project's root folder they want.
      const { projectId } = req.query;
      if (!projectId) {
        return res.status(400).json({ message: "projectId is required when retrieving root folder files" });
      }
      const project = await Project.findOne({ _id: projectId, isDeleted: false });
      if (!project) return res.status(404).json({ message: "Project not found" });
      const isMember = project.createdBy.toString() === userId || project.members.some(m => m.userId.toString() === userId);
      if (!isMember) return res.status(403).json({ message: "Access denied" });
      filter.projectId = projectId;
    }

    if (category) filter.category = category;
    if (search) filter.fileName = { $regex: search, $options: "i" };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const files = await File.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name email");

    const total = await File.countDocuments(filter);

    return res.status(200).json({
      data: files,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retrieve files by folder ID",
      error: error.message,
    });
  }
};

// Update File Metadata (rename / move folder / updatedBy)
exports.updateFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileName, folderId, updatedBy } = req.body;
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const file = await File.findById(id);
    if (!file || file.status !== "active") {
      return res.status(404).json({ message: "File not found or not active" });
    }

    const project = await Project.findOne({ _id: file.projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ message: "Associated project not found" });
    }
    const isMember = project.createdBy.toString() === userId || project.members.some(m => m.userId.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Set attribute updatedBy dengan user yang melakukan update (dari token JWT atau body)
    const updaterId = userId || updatedBy;
    if (updaterId) {
      file.updatedBy = updaterId;
    }

    if (fileName !== undefined) file.fileName = fileName;
    if (folderId !== undefined) file.folderId = folderId === "" ? null : folderId;

    const updatedFile = await file.save();
    return res.status(200).json({
      message: "File successfully updated",
      data: updatedFile,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update file",
      error: error.message,
    });
  }
};

// Create New Version of File
exports.createFileVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileName, originalName, fileType, category, sizeBytes, fileUrl } = req.body;
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const existingFile = await File.findById(id);
    if (!existingFile || existingFile.status !== "active") {
      return res.status(404).json({ message: "Original file not found" });
    }

    const project = await Project.findOne({ _id: existingFile.projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ message: "Associated project not found" });
    }
    const isMember = project.createdBy.toString() === userId || project.members.some(m => m.userId.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ message: "Access denied" });
    }

    const newVersionFile = new File({
      projectId: existingFile.projectId,
      folderId: existingFile.folderId,
      createdBy: userId || existingFile.createdBy,
      fileName: fileName || existingFile.fileName,
      originalName: originalName || existingFile.originalName,
      fileType: fileType || existingFile.fileType,
      category: category || existingFile.category,
      sizeBytes,
      fileUrl,
      version: (existingFile.version || 1) + 1,
      previousVersionId: existingFile._id,
      status: "active",
    });

    const savedFile = await newVersionFile.save();

    // Sync new file version to existing conversations of the project
    try {
      const { syncNewFileToConversations } = require("../services/chatService");
      await syncNewFileToConversations(existingFile.projectId, savedFile._id);
    } catch (syncError) {
      console.error("Failed to sync new file version to conversations:", syncError.message);
    }

    return res.status(201).json({
      message: "New file version created successfully",
      data: savedFile,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create new file version",
      error: error.message,
    });
  }
};

// Move to Trash (Soft delete)
exports.moveToTrash = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const file = await File.findById(id);
    if (!file || file.status === "deleted") {
      return res.status(404).json({ message: "File not found" });
    }

    const project = await Project.findOne({ _id: file.projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ message: "Associated project not found" });
    }
    const isMember = project.createdBy.toString() === userId || project.members.some(m => m.userId.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ message: "Access denied" });
    }

    file.status = "trash";
    file.deletedAt = new Date(); // Auto purge setelah 30 hari via TTL index

    await file.save();

    return res.status(200).json({
      message: "File moved to trash",
      data: file,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to move file to trash",
      error: error.message,
    });
  }
};

// Restore File from Trash
exports.restoreFromTrash = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const file = await File.findById(id);
    if (!file || file.status !== "trash") {
      return res.status(400).json({ message: "File not in trash" });
    }

    const project = await Project.findOne({ _id: file.projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ message: "Associated project not found" });
    }
    const isMember = project.createdBy.toString() === userId || project.members.some(m => m.userId.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ message: "Access denied" });
    }

    file.status = "active";
    file.deletedAt = null;

    await file.save();

    return res.status(200).json({
      message: "File successfully restored from trash",
      data: file,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to restore file from trash",
      error: error.message,
    });
  }
};

// Hard Delete / Mark status as 'deleted'
exports.deleteFile = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const file = await File.findById(id);
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    const project = await Project.findOne({ _id: file.projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ message: "Associated project not found" });
    }
    const isMember = project.createdBy.toString() === userId || project.members.some(m => m.userId.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ message: "Access denied" });
    }

    file.status = "deleted";
    file.deletedAt = new Date();
    await file.save();

    return res.status(200).json({
      message: "File successfully deleted permanently",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete file permanently",
      error: error.message,
    });
  }
};
