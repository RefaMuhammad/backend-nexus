require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");

// Models
const User = require("../models/User");
const Project = require("../models/Projects");
const Folder = require("../models/Folder");
const File = require("../models/File");
const PRD = require("../models/PRD");

// Controller actions to test
const {
  createPRD,
  getPRDs,
  getPRDById,
  updatePRD,
  moveToTrash,
  restoreFromTrash,
  deletePRD,
  getPRDsByProject,
} = require("../controllers/prdController");

// Helper to mock Express req and res
const mockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

const runTests = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();
    console.log("Database connected successfully.");

    // Clear old test data if any from previous failure
    await User.deleteMany({ email: "test-prd-user@example.com" });

    // 2. Setup Mock Data
    console.log("\n--- Setting up Mock Data ---");
    const testUser = new User({
      email: "test-prd-user@example.com",
      passwordHash: "dummyhash",
      isVerified: true,
      profile: { fullName: "Test PRD User" },
    });
    await testUser.save();
    console.log(`Created Test User ID: ${testUser._id}`);

    const testProject = new Project({
      name: "Nexus Test Project",
      description: "Project for testing generated PRD features",
      createdBy: testUser._id,
      members: [{ userId: testUser._id, role: "owner", status: "accepted" }],
    });
    await testProject.save();
    console.log(`Created Test Project ID: ${testProject._id}`);

    const testFolder = new Folder({
      projectId: testProject._id,
      name: "generated_prd",
      path: "/generated_prd",
      level: 1,
      createdBy: testUser._id,
    });
    await testFolder.save();
    console.log(`Created Test Folder ID: ${testFolder._id}`);

    // Create 1 source file
    const sourceFile = new File({
      projectId: testProject._id,
      folderId: null,
      createdBy: testUser._id,
      fileName: "user_stories.txt",
      originalName: "user_stories.txt",
      fileType: "txt",
      category: "document",
      sizeBytes: 1024,
      fileUrl: "http://storage.com/user_stories.txt",
    });
    await sourceFile.save();
    console.log(`Created Source File ID: ${sourceFile._id}`);

    // Create 3 exported files (pdf, docx, md) inside "generated_prd" folder
    const pdfFile = new File({
      projectId: testProject._id,
      folderId: testFolder._id,
      createdBy: testUser._id,
      fileName: "PRD_nexus.pdf",
      originalName: "PRD_nexus.pdf",
      fileType: "pdf",
      category: "prd",
      sizeBytes: 20480,
      fileUrl: "http://storage.com/generated_prd/PRD_nexus.pdf",
    });
    await pdfFile.save();

    const docxFile = new File({
      projectId: testProject._id,
      folderId: testFolder._id,
      createdBy: testUser._id,
      fileName: "PRD_nexus.docx",
      originalName: "PRD_nexus.docx",
      fileType: "docx",
      category: "prd",
      sizeBytes: 15360,
      fileUrl: "http://storage.com/generated_prd/PRD_nexus.docx",
    });
    await docxFile.save();

    const mdFile = new File({
      projectId: testProject._id,
      folderId: testFolder._id,
      createdBy: testUser._id,
      fileName: "PRD_nexus.md",
      originalName: "PRD_nexus.md",
      fileType: "md",
      category: "prd",
      sizeBytes: 5120,
      fileUrl: "http://storage.com/generated_prd/PRD_nexus.md",
    });
    await mdFile.save();
    console.log("Created 3 Exported files (.pdf, .docx, .md) inside the 'generated_prd' folder.");

    const exportedFileIds = [pdfFile._id, docxFile._id, mdFile._id];

    // --- TEST CONTROLLER ENDPOINTS ---
    let savedPrdId = null;

    // Test 1: Create PRD
    console.log("\n--- Test 1: createPRD Controller ---");
    const createReq = {
      user: { id: testUser._id.toString() },
      body: {
        projectId: testProject._id.toString(),
        name: "Workspace System PRD",
        version: 1,
        content: {
          overview: "This is overview",
          features: ["Login", "Dashboard", "PRD Editor"],
        },
        rawMarkdown: "# Overview\nThis project...",
        sourceFileIds: [sourceFile._id.toString()],
        exportedFileIds: exportedFileIds.map((id) => id.toString()),
      },
    };
    const createRes = mockRes();
    await createPRD(createReq, createRes);
    console.log(`Status Code: ${createRes.statusCode}`);
    console.log("Response Body:", JSON.stringify(createRes.body, null, 2));

    if (createRes.statusCode !== 201 || !createRes.body.success) {
      throw new Error("Failed Test 1: createPRD did not return 201 success.");
    }
    savedPrdId = createRes.body.data._id;

    // Test 2: Get List of PRDs
    console.log("\n--- Test 2: getPRDs Controller (List) ---");
    const listReq = {
      user: { id: testUser._id.toString() },
      query: { projectId: testProject._id.toString(), status: "active" },
    };
    const listRes = mockRes();
    await getPRDs(listReq, listRes);
    console.log(`Status Code: ${listRes.statusCode}`);
    console.log(`Items returned: ${listRes.body.data.length}`);
    if (listRes.statusCode !== 200 || listRes.body.data.length !== 1) {
      throw new Error("Failed Test 2: getPRDs did not return list containing our PRD.");
    }

    // Test 2.5: Get PRDs by Project ID
    console.log("\n--- Test 2.5: getPRDsByProject Controller ---");
    const projReq = {
      user: { id: testUser._id.toString() },
      params: { projectId: testProject._id.toString() },
      query: { status: "active" }
    };
    const projRes = mockRes();
    await getPRDsByProject(projReq, projRes);
    console.log(`Status Code: ${projRes.statusCode}`);
    console.log(`Items returned: ${projRes.body.data.length}`);
    if (projRes.statusCode !== 200 || projRes.body.data.length !== 1) {
      throw new Error("Failed Test 2.5: getPRDsByProject did not return list containing our PRD.");
    }

    // Test 3: Get Single PRD by ID (Verify Populated References)
    console.log("\n--- Test 3: getPRDById Controller ---");
    const getReq = {
      user: { id: testUser._id.toString() },
      params: { id: savedPrdId.toString() },
    };
    const getRes = mockRes();
    await getPRDById(getReq, getRes);
    console.log(`Status Code: ${getRes.statusCode}`);
    if (getRes.statusCode !== 200) {
      throw new Error("Failed Test 3: getPRDById did not return 200 success.");
    }

    // Verify populating worked
    const returnedPrd = getRes.body.data;
    if (returnedPrd.sourceFileIds[0].fileName !== "user_stories.txt") {
      throw new Error("Failed Test 3: sourceFileIds populate verification failed.");
    }
    if (returnedPrd.exportedFileIds.length !== 3) {
      throw new Error("Failed Test 3: exportedFileIds populate verification failed.");
    }

    // Test 4: Update PRD
    console.log("\n--- Test 4: updatePRD Controller ---");
    const updateReq = {
      user: { id: testUser._id.toString() },
      params: { id: savedPrdId.toString() },
      body: {
        name: "Nexus Workspace System PRD v2",
        version: 2,
        content: {
          overview: "Updated overview content",
          features: ["Login", "Dashboard", "PRD Editor", "Auto-Export File Sync"],
        },
      },
    };
    const updateRes = mockRes();
    await updatePRD(updateReq, updateRes);
    console.log(`Status Code: ${updateRes.statusCode}`);
    if (updateRes.statusCode !== 200 || updateRes.body.data.name !== "Nexus Workspace System PRD v2") {
      throw new Error("Failed Test 4: updatePRD verification failed.");
    }

    // Test 4.5a: Move to Trash
    console.log("\n--- Test 4.5a: moveToTrash Controller ---");
    const trashReq = {
      user: { id: testUser._id.toString() },
      params: { id: savedPrdId.toString() },
    };
    const trashRes = mockRes();
    await moveToTrash(trashReq, trashRes);
    console.log(`Status Code: ${trashRes.statusCode}`);
    if (trashRes.statusCode !== 200 || trashRes.body.data.status !== "trash") {
      throw new Error("Failed Test 4.5a: moveToTrash did not set status to 'trash'.");
    }

    // Test 4.5b: List active PRDs (should now return 0)
    console.log("\n--- Test 4.5b: getPRDs Controller (Active List is Empty) ---");
    const listActiveReq = {
      user: { id: testUser._id.toString() },
      query: { projectId: testProject._id.toString(), status: "active" },
    };
    const listActiveRes = mockRes();
    await getPRDs(listActiveReq, listActiveRes);
    console.log(`Active Items returned: ${listActiveRes.body.data.length}`);
    if (listActiveRes.body.data.length !== 0) {
      throw new Error("Failed Test 4.5b: active list still returns trashed PRD.");
    }

    // Test 4.5c: List trashed PRDs (should return 1)
    console.log("\n--- Test 4.5c: getPRDs Controller (Trash List has 1 Item) ---");
    const listTrashReq = {
      user: { id: testUser._id.toString() },
      query: { projectId: testProject._id.toString(), status: "trash" },
    };
    const listTrashRes = mockRes();
    await getPRDs(listTrashReq, listTrashRes);
    console.log(`Trash Items returned: ${listTrashRes.body.data.length}`);
    if (listTrashRes.body.data.length !== 1) {
      throw new Error("Failed Test 4.5c: trash list did not return trashed PRD.");
    }

    // Test 4.5d: Restore from Trash
    console.log("\n--- Test 4.5d: restoreFromTrash Controller ---");
    const restoreReq = {
      user: { id: testUser._id.toString() },
      params: { id: savedPrdId.toString() },
    };
    const restoreRes = mockRes();
    await restoreFromTrash(restoreReq, restoreRes);
    console.log(`Status Code: ${restoreRes.statusCode}`);
    if (restoreRes.statusCode !== 200 || restoreRes.body.data.status !== "active") {
      throw new Error("Failed Test 4.5d: restoreFromTrash did not set status back to 'active'.");
    }

    // Test 4.5e: List active PRDs again (should return 1)
    console.log("\n--- Test 4.5e: getPRDs Controller (Active List has 1 Item again) ---");
    const checkActiveRes = mockRes();
    await getPRDs(listActiveReq, checkActiveRes);
    console.log(`Active Items returned: ${checkActiveRes.body.data.length}`);
    if (checkActiveRes.body.data.length !== 1) {
      throw new Error("Failed Test 4.5e: active list does not return restored PRD.");
    }

    // Test 5: Soft Delete PRD
    console.log("\n--- Test 5: deletePRD Controller (Soft Delete) ---");
    const deleteReq = {
      user: { id: testUser._id.toString() },
      params: { id: savedPrdId.toString() },
    };
    const deleteRes = mockRes();
    await deletePRD(deleteReq, deleteRes);
    console.log(`Status Code: ${deleteRes.statusCode}`);
    if (deleteRes.statusCode !== 200) {
      throw new Error("Failed Test 5: deletePRD did not return 200.");
    }

    // Verify it is inaccessible via normal findById controller endpoint
    const checkDeletedReq = {
      user: { id: testUser._id.toString() },
      params: { id: savedPrdId.toString() },
    };
    const checkDeletedRes = mockRes();
    await getPRDById(checkDeletedReq, checkDeletedRes);
    console.log(`Get ID response for soft-deleted: ${checkDeletedRes.statusCode}`);
    if (checkDeletedRes.statusCode !== 404) {
      throw new Error("Failed Test 5: PRD was still fetchable after soft-delete.");
    }

    // Verify database record has status = "deleted"
    const prdInDb = await PRD.findById(savedPrdId);
    if (!prdInDb || prdInDb.status !== "deleted") {
      throw new Error("Failed Test 5: database record status was not 'deleted'.");
    }
    console.log("PRD successfully verified soft-deleted in Database.");

    // 4. Clean up Test Data
    console.log("\n--- Cleaning up Test Data ---");
    await PRD.findByIdAndDelete(savedPrdId);
    await File.deleteMany({ _id: { $in: [sourceFile._id, ...exportedFileIds] } });
    await Folder.findByIdAndDelete(testFolder._id);
    await Project.findByIdAndDelete(testProject._id);
    await User.findByIdAndDelete(testUser._id);
    console.log("Cleanup finished.");

    console.log("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<");
    process.exit(0);
  } catch (error) {
    console.error("Test failed with error:", error);
    process.exit(1);
  }
};

runTests();
