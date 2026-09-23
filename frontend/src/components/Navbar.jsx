const Navbar = ({ onAddClick, onSearch }) => {
  return (
    <nav>
      <h2>Task Manager</h2>

      <input
        type="text"
        placeholder="Search task..."
        onChange={(e) => onSearch(e.target.value)}
      />

      <button onClick={onAddClick}>Add Task</button>
    </nav>
  );
};

export default Navbar;
