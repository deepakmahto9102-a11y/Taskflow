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

    if (!project) return res.status(404).json({ message: "Project not found" });

    const tasks = await Task.find({ project: project._id })
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { title, description, priority, dueDate, projectId } = req.body;

    const project = await Project.findOne({
      _id: projectId,
      owner: req.user.id
    });

    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!title) return res.status(400).json({ message: "Task title is required" });

    const task = await Task.create({
      title,
      description,
      priority,
      dueDate,
      project: projectId,
      createdBy: req.user.id
    });

    const populated = await task.populate("assignedTo", "name email");

    req.app.get("io").to(`project:${projectId}`).emit("taskCreated", populated);

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id", auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate("project");

    if (!task || task.project.owner.toString() !== req.user.id) {
      return res.status(404).json({ message: "Task not found" });
    }

    const allowed = ["title", "description", "status", "priority", "dueDate"];
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) task[key] = req.body[key];
    });

    await task.save();

    req.app.get("io")
      .to(`project:${task.project._id}`)
      .emit("taskUpdated", task);

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate("project");

    if (!task || task.project.owner.toString() !== req.user.id) {
      return res.status(404).json({ message: "Task not found" });
    }

    await task.deleteOne();

    req.app.get("io")
      .to(`project:${task.project._id}`)
      .emit("taskDeleted", { taskId: task._id });

    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
