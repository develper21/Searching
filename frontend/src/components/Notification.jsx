import { useEffect } from "react";

const Notification = ({ message, isVisible, onClose }) => {
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => onClose(), 3000);
    return () => clearTimeout(timer);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className={`toast glass ${isVisible ? "show" : ""}`} role="status">
      ✓ {message}
    </div>
  );
};

export default Notification;
