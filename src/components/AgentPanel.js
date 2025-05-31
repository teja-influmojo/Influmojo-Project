// src/components/AgentPanel.js
import React, { useState, useEffect } from 'react';
import '../styles/Chat.css';

const AgentPanel = ({ supportRequests, activeConversations, onJoinConversation, currentUser }) => {
  const [selectedTab, setSelectedTab] = useState('requests');
  const [loading, setLoading] = useState(false);

  const handleJoinConversation = async (channelUrl, requestId) => {
    setLoading(true);
    try {
      await onJoinConversation(channelUrl);
      // Mark request as handled if needed
      if (requestId) {
        // You can add logic here to mark the support request as taken
      }
    } catch (error) {
      console.error('Failed to join conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getRequestPriority = (request) => {
    // You can implement priority logic based on wait time, customer type, etc.
    const waitTime = Date.now() - request.createdAt;
    const minutes = Math.floor(waitTime / (1000 * 60));
    
    if (minutes > 30) return 'high';
    if (minutes > 10) return 'medium';
    return 'low';
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#e74c3c';
      case 'medium': return '#f39c12';
      default: return '#2ecc71';
    }
  };

  return (
    <div className="agent-panel">
      <div className="panel-header">
        <h3>Support Agent Panel</h3>
        <div className="tab-buttons">
          <button 
            className={selectedTab === 'requests' ? 'active' : ''}
            onClick={() => setSelectedTab('requests')}
          >
            Support Requests ({supportRequests.length})
          </button>
          <button 
            className={selectedTab === 'conversations' ? 'active' : ''}
            onClick={() => setSelectedTab('conversations')}
          >
            Active Chats ({activeConversations.length})
          </button>
        </div>
      </div>

      <div className="panel-content">
        {selectedTab === 'requests' && (
          <div className="support-requests">
            {supportRequests.length === 0 ? (
              <div className="empty-state">
                <p>No pending support requests</p>
                <small>New requests will appear here automatically</small>
              </div>
            ) : (
              <div className="requests-list">
                {supportRequests.map(request => {
                  const priority = getRequestPriority(request);
                  return (
                    <div key={request.id} className="request-card">
                      <div className="request-header">
                        <div className="customer-info">
                          <span className="customer-name">{request.customerName}</span>
                          <span 
                            className="priority-badge"
                            style={{ backgroundColor: getPriorityColor(priority) }}
                          >
                            {priority.toUpperCase()}
                          </span>
                        </div>
                        <div className="request-time">
                          {formatTime(request.createdAt)}
                        </div>
                      </div>
                      <div className="request-details">
                        <p className="request-message">{request.message || 'Customer needs assistance'}</p>
                        <div className="request-meta">
                          <small>Channel: {request.channelName}</small>
                          <small>Wait time: {Math.floor((Date.now() - request.createdAt) / (1000 * 60))} min</small>
                        </div>
                      </div>
                      <div className="request-actions">
                        <button
                          onClick={() => handleJoinConversation(request.channelUrl, request.id)}
                          disabled={loading}
                          className="join-btn"
                        >
                          {loading ? 'Joining...' : 'Join Conversation'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedTab === 'conversations' && (
          <div className="active-conversations">
            {activeConversations.length === 0 ? (
              <div className="empty-state">
                <p>No active conversations</p>
                <small>Conversations you join will appear here</small>
              </div>
            ) : (
              <div className="conversations-list">
                {activeConversations.map(conversation => (
                  <div key={conversation.url} className="conversation-card">
                    <div className="conversation-header">
                      <div className="conversation-info">
                        <span className="conversation-name">{conversation.name}</span>
                        <span className="participants-count">
                          {conversation.memberCount} participants
                        </span>
                      </div>
                      <div className="last-activity">
                        {formatTime(conversation.lastMessage?.createdAt || conversation.createdAt)}
                      </div>
                    </div>
                    <div className="conversation-details">
                      {conversation.lastMessage && (
                        <p className="last-message">
                          <strong>{conversation.lastMessage.sender?.nickname}:</strong> {' '}
                          {conversation.lastMessage.message || '[File]'}
                        </p>
                      )}
                      <div className="conversation-meta">
                        <small>Participants: {conversation.members?.map(m => m.nickname).join(', ')}</small>
                      </div>
                    </div>
                    <div className="conversation-actions">
                      <button
                        onClick={() => handleJoinConversation(conversation.url)}
                        disabled={loading}
                        className="rejoin-btn"
                      >
                        {loading ? 'Opening...' : 'Open Chat'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="panel-footer">
        <div className="agent-stats">
          <div className="stat">
            <span className="stat-number">{supportRequests.length}</span>
            <span className="stat-label">Pending Requests</span>
          </div>
          <div className="stat">
            <span className="stat-number">{activeConversations.length}</span>
            <span className="stat-label">Active Chats</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentPanel;