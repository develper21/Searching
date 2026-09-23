import { useState, useEffect } from "react";

const TaskForm = ({ onSave, selectedTask, onClose }) => {
  const [task, setTask] = useState({
    title: "",
    description: "",
    status: "Not Started"
  });

  useEffect(() => {
    if (selectedTask) {
      setTask(selectedTask);
    }
  }, [selectedTask]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(task);
    setTask({ title: "", description: "", status: "Not Started" });
    onClose();
  };

  const handleClose = () => {
    setTask({ title: "", description: "", status: "Not Started" });
    onClose();
  };

  return (
    <div className="form-overlay" onClick={handleClose}>
      <form onClick={(e) => e.stopPropagation()}>
        <h3>{selectedTask ? "Edit Task" : "Add New Task"}</h3>
        
        <input
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

        <select
          value={task.status}
          onChange={(e) => setTask({ ...task, status: e.target.value })}
        >
          <option value="Not Started">Not Started</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>

        <button type="submit">
          {selectedTask ? "Update Task" : "Add Task"}
        </button>
      </form>
    </div>
  );
};

export default TaskForm;
