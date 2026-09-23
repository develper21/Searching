import SearchBar from "./SearchBar";

const Navbar = ({ onAddClick, onSearch }) => {
  return (
    <nav className="navbar glass">
      <h2 className="brand">
        <span className="brand-dot" /> Task<span>Flow</span>
      </h2>

      <SearchBar onSearch={onSearch} />

      <button className="btn-primary" onClick={onAddClick}>+ Add Task</button>
    </nav>
  );
};

export default Navbar;
