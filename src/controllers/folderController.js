const Folder = require("../models/Folder");

exports.createFolder = async (req, res) => {
  try {
    const { projectId, parentFolderId, name, color } = req.body;
    const userId = req.user ? req.user._id : req.body.createdBy;

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

exports.moveToTrash = async (req, res) => {
  try {
    const { id } = req.params;

    const folder = await Folder.findByIdAndUpdate(
      id,
      { status: "trash", deletedAt: new Date() },
      { new: true }
    );

    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    return res.status(200).json({ message: "Folder moved to trash", data: folder });
  } catch (error) {
    return res.status(500).json({ message: "Failed to move folder to trash", error: error.message });
  }
};

exports.restoreFolder = async (req, res) => {
  try {
    const { id } = req.params;

    const folder = await Folder.findByIdAndUpdate(
      id,
      { status: "active", deletedAt: null },
      { new: true }
    );

    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    return res.status(200).json({ message: "Folder restored successfully", data: folder });
  } catch (error) {
    return res.status(500).json({ message: "Failed to restore folder", error: error.message });
  }
};

exports.deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;

    
    const folder = await Folder.findByIdAndUpdate(
      id,
      { status: "deleted", deletedAt: new Date() },
      { new: true }
    );

    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    return res.status(200).json({ message: "Folder permanently deleted", data: folder });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete folder", error: error.message });
  }
};