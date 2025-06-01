// src/components/AgentUserList.js
import React from 'react';

const AgentUserList = ({ users, onUserSelect, onlineUsers, loading }) => {
  if (loading) {
    return (
      <div className="user-list loading">
        <p>Loading users...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="user-list empty">
        <p>No users available</p>
      </div>
    );
  }

  return (
    <div className="user-list">
      {users.map((user) => (
        <div
          key={user.userId}
          className={`user-item ${onlineUsers.has(user.userId) ? 'online' : 'available'}`}
          onClick={() => onUserSelect(user)}
        >
          <div className="user-avatar">
            {(user.nickname || user.userId).charAt(0).toUpperCase()}
          </div>
          
          <div className="user-info">
            <div className="user-name">
              {user.nickname || user.userId}
            </div>
            <div className="user-status">
              <span className={`status-indicator ${onlineUsers.has(user.userId) ? 'online' : 'available'}`}>
                ●
              </span>
              {onlineUsers.has(user.userId) ? 'Online' : 'available'}
            </div>
          </div>
          
          <div className="user-actions">
            <button 
              className="start-chat-btn"
              onClick={(e) => {
                e.stopPropagation();
                onUserSelect(user);
              }}
            >
              Start Support Chat
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgentUserList;