// src/components/Login.js
import React, { useState } from 'react';
import '../styles/Chat.css';

const Login = ({ onLogin }) => {
  const [selectedUser, setSelectedUser] = useState('');
  const [customUserId, setCustomUserId] = useState('');
  const [customNickname, setCustomNickname] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(false);

  const predefinedUsers = [
    { userId: 'user1', nickname: 'Alice', role: 'Brand' },
    { userId: 'user2', nickname: 'Bob', role: 'Influencer' },
    { userId: 'user3', nickname: 'Charlie', role: 'Support Agent' },
    { userId: 'user4', nickname: 'David', role: 'Support Agent' }
  ];

  const handlePredefinedLogin = async (user) => {
    setLoading(true);
    try {
      await onLogin(user.userId, user.nickname);
    } catch (error) {
      alert('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomLogin = async (e) => {
    e.preventDefault();
    
    if (!customUserId.trim() || !customNickname.trim()) {
      alert('Please enter both User ID and Nickname');
      return;
    }

    setLoading(true);
    try {
      await onLogin(customUserId.trim(), customNickname.trim());
    } catch (error) {
      alert('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Administrator':
        return '#e74c3c';
      case 'Support Agent':
        return '#3498db';
      default:
        return '#2ecc71';
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>SendBird Chat Login</h2>
        
        <div className="login-section">
          <h3>Quick Login</h3>
          <div className="predefined-users">
            {predefinedUsers.map(user => (
              <div key={user.userId} className="user-card">
                <div className="user-info">
                  <div className="user-name">{user.nickname}</div>
                  <div 
                    className="user-role" 
                    style={{ color: getRoleColor(user.role) }}
                  >
                    {user.role}
                  </div>
                  <div className="user-id">ID: {user.userId}</div>
                </div>
                <button
                  onClick={() => handlePredefinedLogin(user)}
                  disabled={loading}
                  className="login-btn"
                  style={{ borderColor: getRoleColor(user.role) }}
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="divider">
          <span>OR</span>
        </div>

        <div className="login-section">
          <button 
            className="toggle-custom-btn"
            onClick={() => setShowCustom(!showCustom)}
          >
            {showCustom ? 'Hide' : 'Show'} Custom Login
          </button>

          {showCustom && (
            <form onSubmit={handleCustomLogin} className="custom-login-form">
              <h3>Custom Login</h3>
              <div className="form-group">
                <label htmlFor="customUserId">User ID:</label>
                <input
                  type="text"
                  id="customUserId"
                  value={customUserId}
                  onChange={(e) => setCustomUserId(e.target.value)}
                  placeholder="Enter your user ID"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="customNickname">Nickname:</label>
                <input
                  type="text"
                  id="customNickname"
                  value={customNickname}
                  onChange={(e) => setCustomNickname(e.target.value)}
                  placeholder="Enter your nickname"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !customUserId.trim() || !customNickname.trim()}
                className="login-btn custom-login-btn"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          )}
        </div>

       
      </div>
    </div>
  );
};

export default Login;