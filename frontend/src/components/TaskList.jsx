const highlightText = (text, terms) => {
  if (!text) return text;
  const clean = terms.filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!clean.length) return text;
  const parts = text.split(new RegExp(`(${clean.join("|")})`, "gi"));
  return parts.map((part, i) =>
    clean.some((t) => new RegExp(`^${t}$`, "i").test(part)) ? (
      <mark key={i}>{part}</mark>
    ) : (
      part
    )
  );
};

const TaskList = ({ tasks, onEdit, onDelete, onStatusChange, highlightTerms = [] }) => {
  return (
    <div className="task-container">
      {tasks.map((task) => (
        <article key={task.id} className="task-card glass">
          <div className="task-top">
            <h3>{highlightTerms.length ? highlightText(task.title, highlightTerms) : task.title}</h3>
            <span className={`status-pill pill-${task.status.toLowerCase().replace(/\s+/g, "-")}`}>
              {task.status}
            </span>
          </div>

          <p>{highlightTerms.length ? highlightText(task.description, highlightTerms) : task.description}</p>

          <div className="task-bottom">
            <select
              value={task.status}
              onChange={(e) => onStatusChange(task.id, { ...task, status: e.target.value })}
              aria-label="Change status"
            >
              <option>Not Started</option>
              <option>In Progress</option>
              <option>Completed</option>
            </select>

            <div className="task-actions">
              <button className="btn-ghost" onClick={() => onEdit(task)}>Edit</button>
              <button className="btn-danger" onClick={() => onDelete(task.id)}>Delete</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};

export default TaskList;
