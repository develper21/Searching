import { useEffect, useState } from "react";

const Notification = ({ message, isVisible, onClose }) => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setTimeout(() => onClose(), 300);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!shouldRender) return null;

  return (
    <div
      className={`notification-popup ${isVisible ? 'show' : 'hide'}`}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: '#4CAF50',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'all 0.3s ease-in-out',
        fontSize: '14px',
        fontWeight: '500'
      }}
    >
      ✓ {message}
    </div>
  );
};

export default Notification;
