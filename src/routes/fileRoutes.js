const express = require("express");
const router = express.Router();
const fileController = require("../controllers/fileController");
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// File CRUD Routes
router.post("/", fileController.createFile);
router.get("/", fileController.getFiles);
router.get("/project/:projectId", fileController.getFilesByProject);
router.get("/folder/:folderId", fileController.getFilesByFolder);
router.get("/:id", fileController.getFileById);
router.put("/:id", fileController.updateFile);
router.post("/:id/version", fileController.createFileVersion);
router.patch("/:id/trash", fileController.moveToTrash);
router.patch("/:id/restore", fileController.restoreFromTrash);
router.delete("/:id", fileController.deleteFile);

module.exports = router;
