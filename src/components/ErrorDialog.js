import React from 'react';

const ErrorDialog = ({ message, onClose }) => {
  return (
    <div className="error-dialog-overlay">
      <div className="error-dialog-content">
        <div className="error-dialog-header">
          <h3>Error</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="error-dialog-body">
          <p>{message}</p>
        </div>
        <div className="error-dialog-footer">
          <button className="close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ErrorDialog; 