const Transcript = require("../models/Transcript");

// POST /api/transcripts
// Create a transcript for a file — one transcript per file (fileId is unique)
exports.createTranscript = async (req, res) => {
  try {
    const { fileId, projectId, fullText, language, durationSeconds, segments } = req.body;
    const createdBy = req.user?.id || req.user?._id;

    if (!createdBy) {
      return res.status(401).json({
        success: false,
        message: "Unauthenticated user (Please include a JWT Token in the Header)",
      });
    }

    const transcript = new Transcript({
      fileId,
      projectId,
      fullText,
      language: language || null,
      durationSeconds,
      segments,
      createdBy,
    });

    await transcript.save();

    res.status(201).json({
      success: true,
      message: "Transcript created successfully",
      data: transcript,
    });
  } catch (error) {
    // Duplicate fileId (unique constraint)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A transcript for this file already exists",
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/transcripts/file/:fileId
// Get the transcript for a specific file
exports.getTranscriptByFileId = async (req, res) => {
  try {
    const { fileId } = req.params;

    const transcript = await Transcript.findOne({ fileId })
      .populate("fileId", "fileName originalName fileType")
      .populate("projectId", "name")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!transcript) {
      return res.status(404).json({ success: false, message: "Transcript not found for this file" });
    }

    res.status(200).json({ success: true, data: transcript });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/transcripts/project/:projectId
// Get all transcripts under a project
exports.getTranscriptsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const transcripts = await Transcript.find({ projectId })
      .populate("fileId", "fileName originalName fileType")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      total: transcripts.length,
      data: transcripts,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/transcripts/:id
// Get a single transcript by its _id
exports.getTranscriptById = async (req, res) => {
  try {
    const { id } = req.params;

    const transcript = await Transcript.findById(id)
      .populate("fileId", "fileName originalName fileType")
      .populate("projectId", "name")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!transcript) {
      return res.status(404).json({ success: false, message: "Transcript not found" });
    }

    res.status(200).json({ success: true, data: transcript });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/transcripts/:id
// Update a transcript — fullText, language, durationSeconds, segments
exports.updateTranscript = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullText, language, durationSeconds, segments } = req.body;
    const updatedBy = req.user?.id || req.user?._id;

    const transcript = await Transcript.findById(id);

    if (!transcript) {
      return res.status(404).json({ success: false, message: "Transcript not found" });
    }

    if (fullText !== undefined) transcript.fullText = fullText;
    if (language !== undefined) transcript.language = language;
    if (durationSeconds !== undefined) transcript.durationSeconds = durationSeconds;
    if (segments !== undefined) transcript.segments = segments;
    if (updatedBy) transcript.updatedBy = updatedBy;

    await transcript.save();

    res.status(200).json({
      success: true,
      message: "Transcript updated successfully",
      data: transcript,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/transcripts/:id/export/txt
// Export transcript as a .txt file download
exports.exportTranscriptToTxt = async (req, res) => {
  try {
    const { id } = req.params;

    const transcript = await Transcript.findById(id).populate("fileId", "fileName originalName");

    if (!transcript) {
      return res.status(404).json({ success: false, message: "Transcript not found" });
    }

    // Helper to format seconds to [HH:]MM:SS
    const formatTime = (seconds) => {
      if (typeof seconds !== "number" || isNaN(seconds)) return "00:00";
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      
      const pad = (num) => String(num).padStart(2, "0");
      
      if (h > 0) {
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
      }
      return `${pad(m)}:${pad(s)}`;
    };

    // Format transcript segments into readable text
    let txtContent = "";
    
    // Add Metadata Header
    const fileName = transcript.fileId?.originalName || transcript.fileId?.fileName || "Untitled File";
    txtContent += `=== TRANSCRIPT: ${fileName} ===\r\n`;
    if (transcript.language) {
      txtContent += `Language: ${transcript.language}\r\n`;
    }
    if (transcript.durationSeconds) {
      txtContent += `Duration: ${formatTime(transcript.durationSeconds)}\r\n`;
    }
    txtContent += `\r\n=== FULL TEXT ===\r\n${transcript.fullText}\r\n\r\n`;
    
    txtContent += `=== TIMESTAMPS ===\r\n`;
    if (transcript.segments && transcript.segments.length > 0) {
      transcript.segments.forEach((seg) => {
        txtContent += `[${formatTime(seg.start)} - ${formatTime(seg.end)}] ${seg.text}\r\n`;
      });
    } else {
      txtContent += "(No segment timestamps available)\r\n";
    }

    // Determine download filename
    let downloadName = "transcript.txt";
    if (transcript.fileId?.originalName) {
      // Remove original extension if any, and append _transcript.txt
      const baseName = transcript.fileId.originalName.replace(/\.[^/.]+$/, "");
      downloadName = `${baseName}_transcript.txt`;
    } else if (transcript.fileId?.fileName) {
      const baseName = transcript.fileId.fileName.replace(/\.[^/.]+$/, "");
      downloadName = `${baseName}_transcript.txt`;
    }

    // Set headers to trigger file download
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(downloadName)}"`
    );

    return res.send(txtContent);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

