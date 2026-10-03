import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import api from "./api";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const { data } = await api.post(endpoint, form);

      localStorage.setItem("taskflow_token", data.token);
      localStorage.setItem("taskflow_user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>TaskFlow</h1>
        <p>Manage projects and tasks in one place.</p>

        <form onSubmit={submit}>
          {mode === "register" && (
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />

          {error && <div className="error">{error}</div>}

          <button>{mode === "login" ? "Login" : "Create account"}</button>
        </form>

        <button className="link-btn" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Create a new account" : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
}

function Dashboard({ user, logout }) {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!selected) return;

    loadTasks(selected._id);

    const socket = io(SOCKET_URL);
    socket.emit("joinProject", selected._id);

    socket.on("taskCreated", (task) => setTasks((old) => [task, ...old]));
    socket.on("taskUpdated", (updated) =>
      setTasks((old) => old.map((t) => t._id === updated._id ? updated : t))
    );
    socket.on("taskDeleted", ({ taskId }) =>
      setTasks((old) => old.filter((t) => t._id !== taskId))
    );

    return () => socket.disconnect();
  }, [selected]);

  async function loadProjects() {
    const { data } = await api.get("/projects");
    setProjects(data);
  }

  async function loadTasks(projectId) {
    const { data } = await api.get(`/tasks/project/${projectId}`);
    setTasks(data);
  }

  async function createProject(e) {
    e.preventDefault();
    if (!projectName.trim()) return;

    const { data } = await api.post("/projects", {
      name: projectName,
      description: "TaskFlow project"
    });

    setProjects((old) => [data, ...old]);
    setProjectName("");
    setSelected(data);
  }

  async function deleteProject(id) {
    await api.delete(`/projects/${id}`);
    setProjects((old) => old.filter((p) => p._id !== id));
    if (selected?._id === id) {
      setSelected(null);
      setTasks([]);
    }
  }

  async function createTask(e) {
    e.preventDefault();
    if (!selected || !taskTitle.trim()) return;

    await api.post("/tasks", {
      title: taskTitle,
      priority,
      dueDate: dueDate || undefined,
      projectId: selected._id
    });

    setTaskTitle("");
    setDueDate("");
    setPriority("Medium");
  }

  async function updateTask(task, status) {
    const { data } = await api.patch(`/tasks/${task._id}`, { status });
    setTasks((old) => old.map((t) => t._id === data._id ? data : t));
  }

  async function deleteTask(id) {
    await api.delete(`/tasks/${id}`);
    setTasks((old) => old.filter((t) => t._id !== id));
  }

  return (
    <div>
      <header className="topbar">
        <div>
          <strong>TaskFlow</strong>
          <span>Project Management</span>
        </div>
        <div>
          <span>Hello, {user.name}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="layout">
        <aside className="sidebar">
          <h2>Projects</h2>

          <form onSubmit={createProject} className="stack">
            <input
              placeholder="New project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
            <button>Create Project</button>
          </form>

          <div className="project-list">
            {projects.map((project) => (
              <div
                key={project._id}
                className={`project-item ${selected?._id === project._id ? "active" : ""}`}
              >
                <button onClick={() => setSelected(project)}>
                  {project.name}
                </button>
                <button className="danger-small" onClick={() => deleteProject(project._id)}>×</button>
              </div>
            ))}
          </div>
        </aside>

        <section className="content">
          {!selected ? (
            <div className="empty">
              <h2>Welcome to TaskFlow</h2>
              <p>Create a project to start managing tasks.</p>
            </div>
          ) : (
            <>
              <div className="content-header">
                <div>
                  <h1>{selected.name}</h1>
                  <p>{tasks.length} task(s)</p>
                </div>
              </div>

              <form className="task-form" onSubmit={createTask}>
                <input
                  placeholder="Task title"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                />

                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>

                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />

                <button>Add Task</button>
              </form>

              <div className="tasks">
                {tasks.map((task) => (
                  <article className="task-card" key={task._id}>
                    <div>
                      <h3>{task.title}</h3>
                      <div className="badges">
                        <span>{task.priority}</span>
                        <span>{task.status}</span>
                        {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                      </div>
                    </div>

                    <div className="task-actions">
                      <select value={task.status} onChange={(e) => updateTask(task, e.target.value)}>
                        <option>Todo</option>
                        <option>In Progress</option>
                        <option>Completed</option>
                      </select>
                      <button className="danger" onClick={() => deleteTask(task._id)}>Delete</button>
                    </div>
                  </article>
                ))}

                {tasks.length === 0 && <p className="muted">No tasks yet.</p>}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("taskflow_user");
    return saved ? JSON.parse(saved) : null;
  });

  function logout() {
    localStorage.removeItem("taskflow_token");
    localStorage.removeItem("taskflow_user");
    setUser(null);
  }

  return user
    ? <Dashboard user={user} logout={logout} />
    : <Auth onLogin={setUser} />;
}
