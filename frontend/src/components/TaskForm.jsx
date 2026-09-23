import { useEffect, useRef, useState } from "react";

const EMPTY = { title: "", description: "", status: "Not Started" };

const TaskForm = ({ onSave, selectedTask, onClose }) => {
  const [task, setTask] = useState(selectedTask || EMPTY);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const title = task.title.trim();
    if (!title) return;
    onSave({ ...task, title });
  };

  return (
    <div className="form-overlay" onMouseDown={onClose}>
      <form className="glass modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>{selectedTask ? "Edit Task" : "Add New Task"}</h3>

        <input
          ref={inputRef}
          type="text"
          placeholder="Task Title"
          value={task.title}
          onChange={(e) => setTask({ ...task, title: e.target.value })}
          required
        />

        <textarea
          placeholder="Task Description"
          value={task.description}
          onChange={(e) => setTask({ ...task, description: e.target.value })}
        />

        <select value={task.status} onChange={(e) => setTask({ ...task, status: e.target.value })}>
          <option value="Not Started">Not Started</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>

        <div className="form-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">
            {selectedTask ? "Update Task" : "Add Task"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskForm;
