// src/App.js
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import ChatRoom from './components/ChatRoom';
import AdminDashboard from './components/AdminDashboard';
import AgentDashboard from './components/AgentDashboard';
import sendbirdService from './services/sendbirdService';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in (you might want to use localStorage here)
    // For now, we'll just set loading to false
    setLoading(false);
  }, []);

  const handleLogin = async (userId, nickname) => {
    try {
      const user = await sendbirdService.connect(userId, nickname);
      setCurrentUser({
        ...user,
        nickname: nickname
      });
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const getUserRole = (userId) => {
    if (userId === 'admin') return 'admin';
    if (userId.startsWith('agent')) return 'agent';
    return 'user';
  };

  const renderDashboard = () => {
    const role = getUserRole(currentUser.userId);
    
    switch (role) {
      case 'admin':
        return (
          <AdminDashboard 
            currentUser={currentUser} 
            onLogout={handleLogout} 
          />
        );
      case 'agent':
        return (
          <AgentDashboard 
            currentUser={currentUser} 
            onLogout={handleLogout} 
          />
        );
      default:
        return (
          <ChatRoom 
            currentUser={currentUser} 
            onLogout={handleLogout} 
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {currentUser ? (
        renderDashboard()
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;