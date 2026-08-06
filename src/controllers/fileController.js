const File = require("../models/File");

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

    const filter = { status };

    if (projectId) filter.projectId = projectId;
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
    const file = await File.findById(id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("previousVersionId");

    if (!file || file.status === "deleted") {
      return res.status(404).json({ message: "File not found" });
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

    // Menangani kasus 'root' folder (folderId === 'null' atau 'root')
    const parsedFolderId = folderId === "null" || folderId === "root" ? null : folderId;

    const filter = { folderId: parsedFolderId, status };
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

    const file = await File.findById(id);
    if (!file || file.status !== "active") {
      return res.status(404).json({ message: "File not found or not active" });
    }

    // Set attribute updatedBy dengan user yang melakukan update (dari token JWT atau body)
    const updaterId = req.user?.id || req.user?._id || updatedBy;
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

    const existingFile = await File.findById(id);
    if (!existingFile || existingFile.status !== "active") {
      return res.status(404).json({ message: "Original file not found" });
    }

    const creatorId = req.user?.id || req.user?._id;

    const newVersionFile = new File({
      projectId: existingFile.projectId,
      folderId: existingFile.folderId,
      createdBy: creatorId || existingFile.createdBy,
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

    const file = await File.findById(id);
    if (!file || file.status === "deleted") {
      return res.status(404).json({ message: "File not found" });
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

    const file = await File.findById(id);
    if (!file || file.status !== "trash") {
      return res.status(400).json({ message: "File not in trash" });
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

    const file = await File.findById(id);
    if (!file) {
      return res.status(404).json({ message: "File not found" });
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
