const Folder = require("../models/Folder");
const File = require("../models/File");

// Helper function untuk mencari semua ID folder dan sub-folder secara rekursif
const getAllSubFolderIds = async (folderId) => {
  let folderIds = [folderId];
  let currentParents = [folderId];

  while (currentParents.length > 0) {
    const children = await Folder.find({ parentFolderId: { $in: currentParents } }).select("_id");
    if (children.length === 0) break;
    currentParents = children.map((c) => c._id);
    folderIds = folderIds.concat(currentParents);
  }

  return folderIds;
};

exports.createFolder = async (req, res) => {
  try {
    const { projectId, parentFolderId, name, color, createdBy } = req.body;
    const userId = req.user?.id || req.user?._id || createdBy;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthenticated user (Please include a JWT Token in Header or createdBy in Body)",
      });
    }

    let path = `/${name}`;
    let level = 1;


    if (parentFolderId) {
      const parentFolder = await Folder.findById(parentFolderId);
      if (!parentFolder) {
        return res.status(404).json({ message: "Parent folder not found" });
      }

      if (parentFolder.level >= 5) {
        return res.status(400).json({ message: "Maximum folder depth is 5 levels" });
      }

      path = `${parentFolder.path}/${name}`;
      level = parentFolder.level + 1;
    } else {
      path = `/Root/${name}`;
    }

    const newFolder = new Folder({
      projectId,
      parentFolderId: parentFolderId || null,
      name,
      color: color || null,
      path,
      level,
      createdBy: userId,
      status: "active",
    });

    await newFolder.save();
    return res.status(201).json({ message: "Folder created successfully", data: newFolder });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create folder", error: error.message });
  }
};

exports.getAllFolders = async (req, res) => {
  try {
    const { status = "active" } = req.query;
    const filter = status === "all" ? {} : { status };
    const folders = await Folder.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ data: folders });
  } catch (error) {
    return res.status(500).json({ message: "Failed to retrieve all folders", error: error.message });
  }
};

exports.getFoldersByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status = "active", parentFolderId } = req.query;

    const filter = { projectId };
    if (status !== "all") {
      filter.status = status;
    }
    if (parentFolderId !== undefined) {
      filter.parentFolderId = parentFolderId === "null" ? null : parentFolderId;
    }

    const folders = await Folder.find(filter).sort({ name: 1 });
    return res.status(200).json({ data: folders });
  } catch (error) {
    return res.status(500).json({ message: "Failed to retrieve folders", error: error.message });
  }
};

exports.getFolderById = async (req, res) => {
  try {
    const { id } = req.params;
    const folder = await Folder.findById(id);

    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    return res.status(200).json({ data: folder });
  } catch (error) {
    return res.status(500).json({ message: "Failed to retrieve folder", error: error.message });
  }
};

// Move Folder to Trash (Cascades to subfolders & files)
exports.moveToTrash = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    const targetFolderIds = await getAllSubFolderIds(id);

    const folder = await Folder.findByIdAndUpdate(
      id,
      { status: "trash", deletedAt: now },
      { new: true }
    );

    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    // Update status seluruh subfolder & file di dalamnya
    await Folder.updateMany(
      { _id: { $in: targetFolderIds } },
      { status: "trash", deletedAt: now }
    );

    await File.updateMany(
      { folderId: { $in: targetFolderIds } },
      { status: "trash", deletedAt: now }
    );

    return res.status(200).json({ message: "Folder and contained items moved to trash", data: folder });
  } catch (error) {
    return res.status(500).json({ message: "Failed to move folder to trash", error: error.message });
  }
};

// Restore Folder from Trash (Cascades to subfolders & files)
exports.restoreFolder = async (req, res) => {
  try {
    const { id } = req.params;

    const targetFolderIds = await getAllSubFolderIds(id);

    const folder = await Folder.findByIdAndUpdate(
      id,
      { status: "active", deletedAt: null },
      { new: true }
    );

    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    // Restore status seluruh subfolder & file di dalamnya
    await Folder.updateMany(
      { _id: { $in: targetFolderIds } },
      { status: "active", deletedAt: null }
    );

    await File.updateMany(
      { folderId: { $in: targetFolderIds } },
      { status: "active", deletedAt: null }
    );

    return res.status(200).json({ message: "Folder and contained items restored successfully", data: folder });
  } catch (error) {
    return res.status(500).json({ message: "Failed to restore folder", error: error.message });
  }
};

// Permanently Delete Folder (Cascades to subfolders & files)
exports.deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    const targetFolderIds = await getAllSubFolderIds(id);

    const folder = await Folder.findByIdAndUpdate(
      id,
      { status: "deleted", deletedAt: now },
      { new: true }
    );

    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    // Mark status seluruh subfolder & file di dalamnya sebagai 'deleted'
    await Folder.updateMany(
      { _id: { $in: targetFolderIds } },
      { status: "deleted", deletedAt: now }
    );

    await File.updateMany(
      { folderId: { $in: targetFolderIds } },
      { status: "deleted", deletedAt: now }
    );

    return res.status(200).json({ message: "Folder and contained items permanently deleted", data: folder });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete folder", error: error.message });
  }
};