// src/components/AdminPanel.js
import React, { useState, useEffect } from 'react';
import '../styles/Chat.css';

const AdminPanel = ({ allChannels, allUsers, onJoinConversation, currentUser }) => {
  const [selectedTab, setSelectedTab] = useState('conversations');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const handleJoinConversation = async (channelUrl) => {
    setLoading(true);
    try {
      await onJoinConversation(channelUrl);
    } catch (error) {
      console.error('Failed to join conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleDateString() + ' ' + new Date(timestamp).toLocaleTimeString();
  };

  const getChannelStatus = (channel) => {
    const lastActivity = channel.lastMessage?.createdAt || channel.createdAt;
    const hoursSinceActivity = (Date.now() - lastActivity) / (1000 * 60 * 60);
    
    if (hoursSinceActivity < 1) return 'active';
    if (hoursSinceActivity < 24) return 'recent';
    return 'inactive';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#2ecc71';
      case 'recent': return '#f39c12';
      default: return '#95a5a6';
    }
  };

  const getUserRole = (userId) => {
    if (userId.startsWith('admin')) return 'Administrator';
    if (userId.startsWith('agent')) return 'Support Agent';
    return 'Customer';
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Administrator': return '#e74c3c';
      case 'Support Agent': return '#3498db';
      default: return '#2ecc71';
    }
  };

  const filteredChannels = allChannels.filter(channel => {
    if (!searchTerm) return true;
    return channel.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           channel.members?.some(member => 
             member.nickname?.toLowerCase().includes(searchTerm.toLowerCase())
           );
  });

  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = !searchTerm || 
      user.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.userId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterType === 'all') return matchesSearch;
    
    const userRole = getUserRole(user.userId);
    return matchesSearch && userRole === filterType;
  });

  return (
    <div className="admin-panel">
      <div className="panel-header">
        <h3>Administrator Dashboard</h3>
        <div className="tab-buttons">
          <button 
            className={selectedTab === 'conversations' ? 'active' : ''}
            onClick={() => setSelectedTab('conversations')}
          >
            All Conversations ({allChannels.length})
          </button>
          <button 
            className={selectedTab === 'users' ? 'active' : ''}
            onClick={() => setSelectedTab('users')}
          >
            All Users ({allUsers.length})
          </button>
          <button 
            className={selectedTab === 'analytics' ? 'active' : ''}
            onClick={() => setSelectedTab('analytics')}
          >
            Analytics
          </button>
        </div>
      </div>

      <div className="panel-controls">
        <div className="search-bar">
          <input
            type="text"
            placeholder={selectedTab === 'conversations' ? 'Search conversations...' : 'Search users...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        {selectedTab === 'users' && (
          <div className="filter-controls">
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Roles</option>
              <option value="Customer">Customers</option>
              <option value="Support Agent">Support Agents</option>
              <option value="Administrator">Administrators</option>
            </select>
          </div>
        )}
      </div>

      <div className="panel-content">
        {selectedTab === 'conversations' && (
          <div className="admin-conversations">
            {filteredChannels.length === 0 ? (
              <div className="empty-state">
                <p>No conversations found</p>
                <small>Conversations will appear here when users start chatting</small>
              </div>
            ) : (
              <div className="conversations-list">
                {filteredChannels.map(channel => {
                  const status = getChannelStatus(channel);
                  return (
                    <div key={channel.url} className="admin-conversation-card">
                      <div className="conversation-header">
                        <div className="conversation-info">
                          <span className="conversation-name">{channel.name}</span>
                          <span 
                            className="status-badge"
                            style={{ backgroundColor: getStatusColor(status) }}
                          >
                            {status.toUpperCase()}
                          </span>
                        </div>
                        <div className="conversation-meta">
                          <span className="member-count">{channel.memberCount} members</span>
                          <span className="last-activity">{formatTime(channel.lastMessage?.createdAt || channel.createdAt)}</span>
                        </div>
                      </div>
                      <div className="conversation-details">
                        <div className="participants">
                          <strong>Participants:</strong> {channel.members?.map(m => m.nickname).join(', ')}
                        </div>
                        {channel.lastMessage && (
                          <div className="last-message">
                            <strong>Last message:</strong> {channel.lastMessage.message || '[File]'}
                          </div>
                        )}
                        <div className="conversation-stats">
                          <small>Messages: {channel.messageCount || 0}</small>
                          <small>Created: {formatTime(channel.createdAt)}</small>
                        </div>
                      </div>
                      <div className="conversation-actions">
                        <button
                          onClick={() => handleJoinConversation(channel.url)}
                          disabled={loading}
                          className="monitor-btn"
                        >
                          {loading ? 'Opening...' : 'Monitor Chat'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedTab === 'users' && (
          <div className="admin-users">
            {filteredUsers.length === 0 ? (
              <div className="empty-state">
                <p>No users found</p>
                <small>Users matching your criteria will appear here</small>
              </div>
            ) : (
              <div className="users-list">
                {filteredUsers.map(user => {
                  const role = getUserRole(user.userId);
                  return (
                    <div key={user.userId} className="admin-user-card">
                      <div className="user-header">
                        <div className="user-info">
                          <span className="user-name">{user.nickname}</span>
                          <span 
                            className="user-role"
                            style={{ color: getRoleColor(role) }}
                          >
                            {role}
                          </span>
                        </div>
                        <div className="user-status">
                          <span className={`status-indicator ${user.connectionStatus === 'online' ? 'online' : 'offline'}`}>
                            ● {user.connectionStatus === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                      <div className="user-details">
                        <div className="user-id">
                          <strong>User ID:</strong> {user.userId}
                        </div>
                        <div className="user-stats">
                          <small>Last seen: {user.lastSeenAt ? formatTime(user.lastSeenAt) : 'Never'}</small>
                          <small>Joined: {formatTime(user.createdAt)}</small>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedTab === 'analytics' && (
          <div className="admin-analytics">
            <div className="analytics-grid">
              <div className="analytics-card">
                <div className="analytics-header">
                  <h4>System Overview</h4>
                </div>
                <div className="analytics-content">
                  <div className="metric">
                    <span className="metric-value">{allUsers.length}</span>
                    <span className="metric-label">Total Users</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">{allChannels.length}</span>
                    <span className="metric-label">Total Conversations</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">
                      {allChannels.filter(c => getChannelStatus(c) === 'active').length}
                    </span>
                    <span className="metric-label">Active Conversations</span>
                  </div>
                </div>
              </div>

              <div className="analytics-card">
                <div className="analytics-header">
                  <h4>User Distribution</h4>
                </div>
                <div className="analytics-content">
                  <div className="metric">
                    <span className="metric-value">
                      {allUsers.filter(u => getUserRole(u.userId) === 'Customer').length}
                    </span>
                    <span className="metric-label">Customers</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">
                      {allUsers.filter(u => getUserRole(u.userId) === 'Support Agent').length}
                    </span>
                    <span className="metric-label">Support Agents</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">
                      {allUsers.filter(u => getUserRole(u.userId) === 'Administrator').length}
                    </span>
                    <span className="metric-label">Administrators</span>
                  </div>
                </div>
              </div>

              <div className="analytics-card">
                <div className="analytics-header">
                  <h4>Activity Status</h4>
                </div>
                <div className="analytics-content">
                  <div className="metric">
                    <span className="metric-value">
                      {allUsers.filter(u => u.connectionStatus === 'online').length}
                    </span>
                    <span className="metric-label">Online Now</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">
                      {allChannels.filter(c => getChannelStatus(c) === 'recent').length}
                    </span>
                    <span className="metric-label">Recent Activity</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">
                      {allChannels.reduce((total, c) => total + (c.messageCount || 0), 0)}
                    </span>
                    <span className="metric-label">Total Messages</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;