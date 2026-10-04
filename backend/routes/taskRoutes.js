const express = require("express");
const Task = require("../models/Task");
const Project = require("../models/Project");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/project/:projectId", auth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found"
      });
    }

    const tasks = await Task.find({
      project: req.params.projectId
    }).sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      project
    } = req.body;

    if (!title || !project) {
      return res.status(400).json({
        message: "Title and project are required"
      });
    }

    const projectDoc = await Project.findOne({
      _id: project,
      owner: req.user.id
    });

    if (!projectDoc) {
      return res.status(404).json({
        message: "Project not found"
      });
    }

    const task = await Task.create({
      title,
      description,
      status,
      priority,
      dueDate,
      project,
      createdBy: req.user.id
    });

    const io = req.app.get("io");

    if (io) {
      io.to(`project:${project}`).emit("taskCreated", task);
    }

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        message: "Task not found"
      });
    }

    const project = await Project.findOne({
      _id: task.project,
      owner: req.user.id
    });

    if (!project) {
      return res.status(403).json({
        message: "Not authorized"
      });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    const io = req.app.get("io");

    if (io) {
      io.to(`project:${task.project}`).emit(
        "taskUpdated",
        updatedTask
      );
    }

    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        message: "Task not found"
      });
    }

    const project = await Project.findOne({
      _id: task.project,
      owner: req.user.id
    });

    if (!project) {
      return res.status(403).json({
        message: "Not authorized"
      });
    }

    await Task.findByIdAndDelete(req.params.id);

    const io = req.app.get("io");

    if (io) {
      io.to(`project:${task.project}`).emit(
        "taskDeleted",
        { taskId: task._id }
      );
    }

    res.json({
      message: "Task deleted"
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

module.exports = router;
