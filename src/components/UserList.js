// src/components/UserList.js
import React from 'react';

const UserList = ({ users, onUserSelect, loading, selectedUser, onlineUsers, unreadCounts, headerText }) => {
  return (
    <div className="user-list">
      <h3>{headerText}</h3>
      
      {users.length === 0 ? (
        <div className="no-users">
          <p>No other users found. Make sure you have multiple users registered in your SendBird application.</p>
          <p>You can create test users by logging in with different User IDs.</p>
        </div>
      ) : (
        <div className="users">
          {users.map((user) => (
            <div
              key={user.userId}
              className={`user-item ${selectedUser?.userId === user.userId ? 'selected' : ''}`}
              onClick={() => !loading && onUserSelect(user)}
            >
              <div className="user-avatar">
                {user.nickname ? user.nickname.charAt(0).toUpperCase() : user.userId.charAt(0).toUpperCase()}
                {onlineUsers.has(user.userId) && (
                  <span className="online-badge"></span>
                )}
              </div>
              <div className="user-info">
                <div className="user-nickname">
                  {user.nickname || user.userId}
                  {unreadCounts > 0 && selectedUser?.userId !== user.userId && (
                    <span className="notification-badge">{unreadCounts}</span>
                  )}
                </div>
                <div className="user-id">
                  {user.userId}
                </div>
                <div className={`user-status ${onlineUsers.has(user.userId) ? 'online' : 'available'}`}>
                  {onlineUsers.has(user.userId) ? 'Online' : 'available'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {loading && (
        <div className="loading">
          <p>Loading chat...</p>
        </div>
      )}
    </div>
  );
};

export default UserList;