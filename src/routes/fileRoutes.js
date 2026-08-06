const express = require("express");
const router = express.Router();
const fileController = require("../controllers/fileController");
const { verifyToken } = require("../middleware/authMiddleware");

// Middleware autentikasi untuk semua route files
// router.use(verifyToken);

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
