import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import TaskForm from "../components/TaskForm";
import TaskList from "../components/TaskList";
import Notification from "../components/Notification";
import { getTasks, addTask, updateTask, deleteTask } from "../services/api";

const Home = () => {
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [search, setSearch] = useState("");
  const [notification, setNotification] = useState({ isVisible: false, message: "" });

  const showNotification = (message) => {
    setNotification({ isVisible: true, message });
  };

  const hideNotification = () => {
    setNotification({ isVisible: false, message: "" });
  };

  const loadTasks = async () => {
    const res = await getTasks();
    setTasks(res.data);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleSave = async (task) => {
    if (task.id) {
      await updateTask(task.id, task);
    } else {
      await addTask(task);
    }
    setShowForm(false);
    setSelectedTask(null);
    loadTasks();
  };

  const filteredTasks = tasks.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Navbar
        onAddClick={() => setShowForm(true)}
        onSearch={setSearch}
      />

      {showForm && (
        <TaskForm 
          onSave={handleSave} 
          selectedTask={selectedTask} 
          onClose={() => {
            setShowForm(false);
            setSelectedTask(null);
          }}
        />
      )}

      {filteredTasks.length === 0 ? (
        <div className="empty-state">
          <h3>No tasks found</h3>
          <p>{search ? "Try a different search term" : "Start by adding your first task!"}</p>
        </div>
      ) : (
        <TaskList
          tasks={filteredTasks}
          onEdit={(task) => {
            setSelectedTask(task);
            setShowForm(true);
          }}
          onDelete={async (id) => {
            await deleteTask(id);
            showNotification("Task deleted successfully!");
            loadTasks();
          }}
          onStatusChange={async (id, task) => {
            await updateTask(id, task);
            loadTasks();
          }}
        />
      )}

      <Notification
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />
    </>
  );
};

export default Home;
