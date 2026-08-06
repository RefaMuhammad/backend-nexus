const express = require("express");
const router = express.Router();
const folderController = require("../controllers/folderController");

router.post("/", folderController.createFolder);
router.get("/", folderController.getAllFolders);
router.get("/project/:projectId", folderController.getFoldersByProject);
router.get("/:id", folderController.getFolderById);
router.patch("/:id/trash", folderController.moveToTrash);
router.patch("/:id/restore", folderController.restoreFolder);
router.delete("/:id", folderController.deleteFolder);

module.exports = router;
