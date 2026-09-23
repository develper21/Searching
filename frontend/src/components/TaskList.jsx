const TaskList = ({ tasks, onEdit, onDelete, onStatusChange }) => {
  return (
    <div className="task-container">
      {tasks.map((task) => (
        <div key={task.id} className="task-card">
          <h3>{task.title}</h3>
          <p>{task.description}</p>

          <select
            value={task.status}
            onChange={(e) =>
              onStatusChange(task.id, {
                ...task,
                status: e.target.value
              })
            }
          >
            <option>Not Started</option>
            <option>In Progress</option>
            <option>Completed</option>
          </select>

          <div className="task-actions">
            <button
              className="edit-btn"
              onClick={() => onEdit(task)}
            >
              Edit
            </button>

            <button
              className="delete-btn"
              onClick={() => onDelete(task.id)}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TaskList;
