// src/components/AdminDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import sendbirdService from '../services/sendbirdService';
import MessageList from './MessageList';

const AdminDashboard = ({ currentUser, onLogout }) => {
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState('');

  // Load all channels on component mount
  useEffect(() => {
    if (currentUser.userId === 'admin') {
      loadAllChannels();
      setupAdminHandlers();
    }
  }, [currentUser.userId]);

  // Auto-refresh channels every 15 seconds to catch new conversations
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentUser.userId === 'admin' && !loading) {
        console.log('Auto-refreshing channels...');
        loadAllChannels();
      }
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, [currentUser.userId, loading]);

  const setupAdminHandlers = () => {
    const handlerId = `adminHandler_${Date.now()}`;
    
    sendbirdService.addMessageHandler(handlerId, {
      onMessageReceived: (channel, message) => {
        console.log('Admin received message:', message, 'from channel:', channel.url);
        
        // Check if it's a join request message
        if (message.customType === 'join_request') {
          const requestData = JSON.parse(message.data || '{}');
          setJoinRequests(prev => [...prev, {
            id: Date.now(),
            agentId: requestData.agentId || 'unknown',
            agentName: requestData.agentName || 'Unknown Agent',
            channelUrl: channel.url,
            channelName: getChannelDisplayName(channel),
            timestamp: message.createdAt
          }]);
        }
        
        // Update messages if this is the currently selected channel
        if (selectedChannel && channel.url === selectedChannel.url) {
          setMessages(prevMessages => {
            const exists = prevMessages.some(msg => 
              msg.messageId === message.messageId
            );
            if (exists) return prevMessages;
            return [...prevMessages, message];
          });
        }
        
        // Refresh channel list to show latest activity
        loadAllChannels();
      },
      onChannelChanged: (channel) => {
        console.log('Channel changed:', channel.url);
        setChannels(prevChannels => {
          const index = prevChannels.findIndex(ch => ch.url === channel.url);
          if (index >= 0) {
            const newChannels = [...prevChannels];
            newChannels[index] = channel;
            return newChannels;
          } else {
            return [...prevChannels, channel];
          }
        });
      }
    });
  };

  const loadAllChannels = async () => {
    setLoading(true);
    setError(null);
    setDebugInfo('Loading channels...');
    
    try {
      console.log('Admin loading all channels... (attempt:', retryCount + 1, ')');
      
      // Step 1: Try to find Alice-Bob channel directly
      let aliceBobChannel = null;
      try {
        setDebugInfo('Searching for Alice-Bob conversation...');
        aliceBobChannel = await sendbirdService.findChannelByUsers(['user1', 'user2']);
        if (aliceBobChannel) {
          console.log('Found Alice-Bob channel directly:', aliceBobChannel.url);
        }
      } catch (error) {
        console.warn('Direct channel search failed:', error);
      }

      // Step 2: Get all available channels
      setDebugInfo('Fetching all available channels...');
      const allChannels = await sendbirdService.getAllChannelsForAdmin();
      console.log('Raw channels found:', allChannels.length, allChannels);

      // Step 3: Enhanced filtering and detection
      const processedChannels = [];
      
      for (const channel of allChannels) {
        const channelInfo = {
          channel: channel,
          name: channel.name || '',
          memberIds: channel.members?.map(m => m.userId) || [],
          memberNames: channel.members?.map(m => m.nickname || m.userId) || [],
          lastMessage: channel.lastMessage,
          messageCount: channel.messageCount || 0,
          createdAt: channel.createdAt,
          url: channel.url
        };

        // Check if this is Alice-Bob conversation
        const hasAlice = channelInfo.memberIds.includes('user1');
        const hasAliceName = channelInfo.memberNames.some(name => 
          name.toLowerCase().includes('alice') || name === 'user1'
        );
        const hasBob = channelInfo.memberIds.includes('user2');
        const hasBobName = channelInfo.memberNames.some(name => 
          name.toLowerCase().includes('bob') || name === 'user2'
        );

        const isAliceBobChannel = (hasAlice || hasAliceName) && (hasBob || hasBobName);

        // Filter out system/admin channels
        const isSystemChannel = channelInfo.name.includes('_join_request') || 
                              channelInfo.name.includes('Admin Notifications') ||
                              channelInfo.name.includes('admin');

        // Include if it's Alice-Bob channel or has meaningful content
        const hasContent = channel.lastMessage || 
                          channelInfo.messageCount > 0 || 
                          channelInfo.memberIds.length >= 2;

        console.log(`Channel analysis:`, {
          url: channel.url,
          name: channelInfo.name,
          memberIds: channelInfo.memberIds,
          memberNames: channelInfo.memberNames,
          isAliceBobChannel,
          isSystemChannel,
          hasContent,
          messageCount: channelInfo.messageCount,
          include: (isAliceBobChannel || hasContent) && !isSystemChannel
        });

        if ((isAliceBobChannel || hasContent) && !isSystemChannel) {
          processedChannels.push({
            ...channel,
            isAliceBob: isAliceBobChannel,
            displayName: getChannelDisplayName(channel),
            priority: isAliceBobChannel ? 1 : 2 // Alice-Bob gets highest priority
          });
        }
      }

      // Add the directly found Alice-Bob channel if not already included
      if (aliceBobChannel && !processedChannels.some(ch => ch.url === aliceBobChannel.url)) {
        processedChannels.push({
          ...aliceBobChannel,
          isAliceBob: true,
          displayName: getChannelDisplayName(aliceBobChannel),
          priority: 1
        });
      }

      // Sort channels: Alice-Bob first, then by activity
      processedChannels.sort((a, b) => {
        // First priority: Alice-Bob conversations
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        // Second priority: recent activity
        const aTime = a.lastMessage?.createdAt || a.createdAt || 0;
        const bTime = b.lastMessage?.createdAt || b.createdAt || 0;
        return bTime - aTime;
      });

      console.log('Processed channels:', processedChannels);
      setChannels(processedChannels);
      setRetryCount(0);

      // Update debug info
      const aliceBobCount = processedChannels.filter(ch => ch.isAliceBob).length;
      setDebugInfo(
        `Found ${processedChannels.length} channels total. ` +
        `Alice-Bob conversations: ${aliceBobCount}. ` +
        `${aliceBobCount > 0 ? 'Alice-Bob channel found!' : 'No Alice-Bob conversation detected yet.'}`
      );

      if (processedChannels.length === 0) {
        setError('No conversations found. Make sure Alice (user1) and Bob (user2) have started chatting.');
      }

    } catch (error) {
      console.error('Failed to load channels:', error);
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      
      setDebugInfo(`Error loading channels (attempt ${newRetryCount}): ${error.message}`);
      
      if (newRetryCount <= 3) {
        setError(`Failed to load channels (attempt ${newRetryCount}/3). Retrying...`);
        setTimeout(() => {
          loadAllChannels();
        }, 3000);
      } else {
        setError('Failed to load channels after multiple attempts. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadChannelMessages = async (channel) => {
    try {
      console.log('Loading messages for channel:', channel.url);
      setSelectedChannel(channel);
      setMessages([]);
      setDebugInfo(`Loading messages for ${getChannelDisplayName(channel)}...`);
      
      // Try multiple approaches to get messages
      let channelMessages = [];
      
      try {
        // Approach 1: Try admin access
        const adminChannel = await sendbirdService.getChannelForAdmin(channel.url);
        channelMessages = await sendbirdService.getChannelMessages(adminChannel, 100);
        console.log('Loaded messages via admin access:', channelMessages.length);
      } catch (adminError) {
        console.warn('Admin access failed, trying direct access:', adminError);
        
        try {
          // Approach 2: Direct channel access
          channelMessages = await sendbirdService.getChannelMessages(channel, 100);
          console.log('Loaded messages via direct access:', channelMessages.length);
        } catch (directError) {
          console.error('Direct access also failed:', directError);
          throw directError;
        }
      }
      
      setMessages(channelMessages);
      setDebugInfo(
        `Loaded ${channelMessages.length} messages from ${getChannelDisplayName(channel)}. ` +
        `${channel.isAliceBob ? '(Alice-Bob Conversation)' : ''}`
      );
      
    } catch (error) {
      console.error('Failed to load channel messages:', error);
      setError(`Failed to load messages: ${error.message}`);
      setDebugInfo(`Error loading messages: ${error.message}`);
    }
  };

  const getChannelDisplayName = (channel) => {
    if (channel.name && channel.name !== '') {
      return channel.name;
    }
    
    // Generate name from members, exclude admin
    const memberNames = channel.members
      ?.filter(member => member.userId !== 'admin')
      .map(member => {
        // Map user IDs to friendly names
        if (member.userId === 'user1') return member.nickname || 'Alice';
        if (member.userId === 'user2') return member.nickname || 'Bob';
        return member.nickname || member.userId;
      })
      .join(' & ');
    
    return memberNames || 'Unknown Channel';
  };

  const getLastMessage = (channel) => {
    if (channel.lastMessage) {
      const message = channel.lastMessage;
      if (message.messageType === 'user') {
        const senderName = message._sender?.nickname || message._sender?.userId || 'Unknown';
        const messageText = message.message?.length > 50 
          ? message.message.substring(0, 50) + '...' 
          : message.message;
        return `${senderName}: ${messageText}`;
      }
    }
    return 'No messages yet';
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const sendAdminMessage = async (message) => {
    if (!selectedChannel || !message.trim()) return;
    
    try {
      await sendbirdService.sendAdminMessage(selectedChannel.url, message);
      // Reload messages to show the sent message
      loadChannelMessages(selectedChannel);
    } catch (error) {
      console.error('Failed to send admin message:', error);
      setError('Failed to send message');
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h2>Admin Dashboard - Conversation Monitor</h2>
        <div className="header-actions">
          <button onClick={loadAllChannels} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh Channels'}
          </button>
          <button onClick={onLogout}>Logout</button>
        </div>
      </div>

      {/* Debug Info */}
      <div className="debug-info" style={{ 
        background: '#f5f5f5', 
        padding: '10px', 
        margin: '10px 0', 
        borderRadius: '4px',
        fontSize: '14px',
        color: '#666'
      }}>
        <strong>Status:</strong> {debugInfo}
      </div>

      {error && (
        <div className="error-message" style={{ 
          background: '#ffe6e6', 
          color: '#d00', 
          padding: '10px', 
          borderRadius: '4px',
          margin: '10px 0'
        }}>
          {error}
        </div>
      )}

      <div className="dashboard-content">
        {/* Channel List */}
        <div className="channels-panel">
          <h3>Conversations ({channels.length})</h3>
          
          {loading && <p>Loading channels...</p>}
          
          {channels.length === 0 && !loading && (
            <div className="no-channels">
              <p>No conversations found.</p>
              <p>Make sure Alice (user1) and Bob (user2) have started chatting.</p>
              <button onClick={loadAllChannels}>Try Again</button>
            </div>
          )}

          <div className="channel-list">
            {channels.map((channel) => (
              <div 
                key={channel.url}
                className={`channel-item ${selectedChannel?.url === channel.url ? 'selected' : ''} ${channel.isAliceBob ? 'alice-bob-channel' : ''}`}
                onClick={() => loadChannelMessages(channel)}
                style={{
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  margin: '8px 0',
                  cursor: 'pointer',
                  backgroundColor: selectedChannel?.url === channel.url ? '#e3f2fd' : 
                                  channel.isAliceBob ? '#e8f5e8' : '#fff',
                  borderLeft: channel.isAliceBob ? '4px solid #4caf50' : '4px solid transparent'
                }}
              >
                <div className="channel-header">
                  <strong>{getChannelDisplayName(channel)}</strong>
                  {channel.isAliceBob && (
                    <span style={{ 
                      background: '#4caf50', 
                      color: 'white', 
                      padding: '2px 6px', 
                      borderRadius: '10px', 
                      fontSize: '12px',
                      marginLeft: '8px'
                    }}>
                      Alice & Bob
                    </span>
                  )}
                </div>
                <div className="channel-info">
                  <div className="last-message">{getLastMessage(channel)}</div>
                  <div className="channel-meta">
                    <span>Members: {channel.members?.length || 0}</span>
                    {channel.lastMessage && (
                      <span> • {formatTime(channel.lastMessage.createdAt)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Messages Panel */}
        <div className="messages-panel">
          {selectedChannel ? (
            <>
              <div className="messages-header">
                <h3>{getChannelDisplayName(selectedChannel)}</h3>
                <div className="channel-details">
                  <span>Members: {selectedChannel.members?.map(m => m.nickname || m.userId).join(', ')}</span>
                  <span> • Messages: {messages.length}</span>
                  {selectedChannel.isAliceBob && (
                    <span style={{ color: '#4caf50', fontWeight: 'bold' }}> • Alice & Bob Conversation</span>
                  )}
                </div>
              </div>
              
              <MessageList 
                messages={messages} 
                currentUser={currentUser}
                onSendMessage={sendAdminMessage}
                isAdmin={true}
              />
            </>
          ) : (
            <div className="no-selection">
              <h3>Select a conversation to view messages</h3>
              <p>Choose a channel from the left panel to monitor the conversation.</p>
            </div>
          )}
        </div>
      </div>

      {/* Join Requests */}
      {joinRequests.length > 0 && (
        <div className="join-requests">
          <h3>Join Requests ({joinRequests.length})</h3>
          {joinRequests.map((request) => (
            <div key={request.id} className="join-request-item">
              <p><strong>{request.agentName}</strong> wants to join <em>{request.channelName}</em></p>
              <p>Time: {formatTime(request.timestamp)}</p>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .admin-dashboard {
          height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #ddd;
          background: #f8f9fa;
        }
        
        .dashboard-content {
          flex: 1;
          display: flex;
          min-height: 0;
        }
        
        .channels-panel {
          width: 350px;
          border-right: 1px solid #ddd;
          padding: 20px;
          overflow-y: auto;
        }
        
        .messages-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 20px;
        }
        
        .messages-header {
          border-bottom: 1px solid #ddd;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        
        .channel-details {
          font-size: 14px;
          color: #666;
          margin-top: 5px;
        }
        
        .no-selection, .no-channels {
          text-align: center;
          color: #666;
          margin-top: 50px;
        }
        
        .alice-bob-channel {
          box-shadow: 0 2px 4px rgba(76, 175, 80, 0.1);
        }
        
        .join-requests {
          border-top: 1px solid #ddd;
          padding: 20px;
          background: #f8f9fa;
          max-height: 200px;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;