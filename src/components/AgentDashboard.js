import React, { useState, useEffect } from 'react';
import sendbirdService from '../services/sendbirdService';
import ChatRoom from './ChatRoom';

const AgentDashboard = ({ currentUser, onLogout }) => {
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      setLoading(true);
      const allChannels = await sendbirdService.getAllChannels();
      setChannels(allChannels);
    } catch (error) {
      console.error('Failed to load channels:', error);
      setError('Failed to load channels. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChannelSelect = async (channel) => {
    try {
      setSelectedChannel(channel);
      // Join the channel if not already a member
      if (!channel.members.some(member => member.userId === currentUser.userId)) {
        await sendbirdService.addUserToChannel(channel.url, currentUser.userId);
      }
    } catch (error) {
      console.error('Failed to join channel:', error);
      setError('Failed to join channel. Please try again.');
    }
  };

  const handleJoinRequest = async (channel, requestData) => {
    try {
      await sendbirdService.sendJoinRequest(channel.url, {
        agentName: currentUser.nickname,
        reason: requestData.reason
      });
      // Also notify admin
      await sendbirdService.sendJoinRequestToAdmin({
        agentName: currentUser.nickname,
        reason: requestData.reason
      }, channel);
    } catch (error) {
      console.error('Failed to send join request:', error);
      setError('Failed to send join request. Please try again.');
    }
  };

  if (loading) {
    return <div className="loading">Loading channels...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="agent-dashboard">
      <div className="dashboard-header">
        <h2>Agent Dashboard</h2>
        <div className="user-info">
          <span>Welcome, {currentUser.nickname}!</span>
          <button onClick={onLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="channels-panel">
          <h3>Available Channels</h3>
          <div className="channel-list">
            {channels.map(channel => (
              <div
                key={channel.url}
                className={`channel-item ${selectedChannel?.url === channel.url ? 'selected' : ''}`}
                onClick={() => handleChannelSelect(channel)}
              >
                <div className="channel-info">
                  <h4>{sendbirdService.getChannelDisplayName(channel)}</h4>
                  <span className="member-count">
                    {channel.memberCount} members
                  </span>
                </div>
                {!channel.members.some(member => member.userId === currentUser.userId) && (
                  <button
                    className="join-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoinRequest(channel, { reason: 'Agent wants to join' });
                    }}
                  >
                    Request to Join
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="chat-panel">
          {selectedChannel ? (
            <ChatRoom
              currentUser={currentUser}
              onLogout={onLogout}
              initialChannel={selectedChannel}
            />
          ) : (
            <div className="no-channel-selected">
              <p>Select a channel to start chatting</p>
            </div>
          )}
        </div>
      </div>

      
    </div>
  );
};

export default AgentDashboard; 