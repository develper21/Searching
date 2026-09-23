import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import TaskForm from "../components/TaskForm";
import TaskList from "../components/TaskList";
import Notification from "../components/Notification";
import {
  getTasks,
  addTask,
  updateTask,
  deleteTask,
  searchTasks,
  recordSearchClick,
  getTrending,
} from "../services/api";

const STATUSES = ["", "Not Started", "In Progress", "Completed"];

const Home = () => {
  const [tasks, setTasks] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState("home"); // home | results
  const [searchData, setSearchData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [notification, setNotification] = useState({ isVisible: false, message: "" });

  const showNotification = (message) => setNotification({ isVisible: true, message });
  const hideNotification = () => setNotification({ isVisible: false, message: "" });

  const loadTasks = async () => {
    const res = await getTasks();
    setTasks(res.data);
  };

  const loadTrending = async () => {
    try {
      const res = await getTrending();
      setTrending(res.data.trending);
    } catch {
      /* backend down — ignore */
    }
  };

  useEffect(() => {
    loadTasks();
    loadTrending();
  }, []);

  // Google-style: a committed query switches to the results view.
  const runSearch = async (q, status = statusFilter) => {
    const trimmed = (q || "").trim();
    setQuery(trimmed);
    if (!trimmed) {
      setView("home");
      setSearchData(null);
      loadTasks();
      return;
    }
    setView("results");
    setLoading(true);
    try {
      const res = await searchTasks(trimmed, status);
      setSearchData(res.data);
      // feed the trending engine (like Google counting query popularity)
      recordSearchClick(trimmed).catch(() => {});
    } catch {
      setSearchData({ query: trimmed, results: [], total: 0, tookMs: 0, didYouMean: null, related: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    if (view === "results") runSearch(query, status);
  };

  const clearSearch = () => {
    setQuery("");
    setStatusFilter("");
    setSearchData(null);
    setView("home");
    loadTasks();
    loadTrending();
  };

  const handleSave = async (task) => {
    if (task.id) await updateTask(task.id, task);
    else await addTask(task);
    setShowForm(false);
    setSelectedTask(null);
    showNotification(task.id ? "Task updated successfully!" : "Task added successfully!");
    if (view === "results") runSearch(query);
    else loadTasks();
  };

  const handleDelete = async (id) => {
    await deleteTask(id);
    showNotification("Task deleted successfully!");
    if (view === "results") runSearch(query);
    else loadTasks();
  };

  const handleStatusChange = async (id, task) => {
    await updateTask(id, task);
    if (view === "results") runSearch(query);
    else loadTasks();
  };

  const openEdit = (task) => {
    setSelectedTask(task);
    setShowForm(true);
  };

  // Terms to highlight across result cards.
  const highlightTerms = searchData
    ? [...new Set([...(searchData.query || "").split(" "), ...searchData.results.flatMap((r) => r.matchedTerms)])].filter(Boolean)
    : [];

  const results = searchData?.results || [];

  return (
    <>
      <Navbar onAddClick={() => setShowForm(true)} onSearch={runSearch} />

      {view === "results" ? (
        <main className="page">
          <div className="results-toolbar glass">
            <div className="results-meta">
              <span className="results-query">“{query}”</span>
              <span className="results-count">
                {loading ? "Searching…" : `${searchData?.total ?? 0} result${searchData?.total === 1 ? "" : "s"} · ${searchData?.tookMs ?? 0} ms`}
              </span>
            </div>
            <div className="toolbar-actions">
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {STATUSES.slice(1).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button className="btn-ghost" onClick={clearSearch}>✕ Clear</button>
            </div>
          </div>

          {searchData?.didYouMean && (
            <div className="did-you-mean">
              Did you mean{" "}
              <button className="dym-link" onClick={() => runSearch(searchData.didYouMean)}>
                {searchData.didYouMean}
              </button>
              ?
            </div>
          )}

          {loading ? (
            <div className="empty-state">
              <div className="spinner" />
              <p>Searching tasks…</p>
            </div>
          ) : results.length === 0 ? (
            <div className="empty-state">
              <h3>No results found</h3>
              <p>No tasks match “{query}”. Try different keywords.</p>
              {searchData?.related?.length > 0 && (
                <div className="chip-row">
                  {searchData.related.map((term) => (
                    <button key={term} className="chip" onClick={() => runSearch(term)}>🔍 {term}</button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {searchData?.related?.length > 0 && (
                <div className="chip-row related-row">
                  <span className="chip-label">Related:</span>
                  {searchData.related.map((term) => (
                    <button key={term} className="chip" onClick={() => runSearch(term)}>{term}</button>
                  ))}
                </div>
              )}
              <TaskList tasks={results} highlightTerms={highlightTerms} onEdit={openEdit} onDelete={handleDelete} onStatusChange={handleStatusChange} />
            </>
          )}
        </main>
      ) : (
        <main className="page">
          {trending.length > 0 && (
            <div className="chip-row trending-row">
              <span className="chip-label">🔥 Trending searches:</span>
              {trending.map((t) => (
                <button key={t} className="chip" onClick={() => runSearch(t)}>{t}</button>
              ))}
            </div>
          )}

          {tasks.length === 0 ? (
            <div className="empty-state">
              <h3>No tasks yet</h3>
              <p>Start by adding your first task!</p>
              <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Task</button>
            </div>
          ) : (
            <TaskList tasks={tasks} onEdit={openEdit} onDelete={handleDelete} onStatusChange={handleStatusChange} />
          )}
        </main>
      )}

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

      <Notification message={notification.message} isVisible={notification.isVisible} onClose={hideNotification} />
    </>
  );
};

export default Home;
