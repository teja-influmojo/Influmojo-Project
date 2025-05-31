// src/components/ChatRoom.js
import React, { useState, useEffect, useCallback } from 'react';
import sendbirdService from '../services/sendbirdService';
import moderationService from '../services/moderationService';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import UserList from './UserList';
import ModerationPanel from './ModerationPanel';

const ChatRoom = ({ currentUser, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [channel, setChannel] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModerationPanel, setShowModerationPanel] = useState(false);
  const [isOperator, setIsOperator] = useState(false);
  const [channelFrozen, setChannelFrozen] = useState(false);

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);

  // Check operator status when channel changes
  useEffect(() => {
    if (channel) {
      setIsOperator(sendbirdService.isOperator());
      setChannelFrozen(channel.isFrozen);
    }
  }, [channel]);

  // Set up message handlers
  useEffect(() => {
    const handlerId = `messageHandler_${Date.now()}`;
    
    sendbirdService.addMessageHandler(handlerId, {
      onMessageReceived: (channel, message) => {
        console.log('Message received:', message);
        setMessages(prevMessages => [...prevMessages, message]);
      },
      onMessageDeleted: (channel, messageId) => {
        console.log('Message deleted:', messageId);
        setMessages(prevMessages => 
          prevMessages.filter(msg => msg.messageId !== messageId)
        );
      },
      onUserJoined: (channel, user) => {
        console.log('User joined:', user);
        // Refresh user list if needed
        loadUsers();
      },
      onUserLeft: (channel, user) => {
        console.log('User left:', user);
        // Refresh user list if needed
        loadUsers();
      },
      onUserBanned: (channel, user) => {
        console.log('User banned:', user);
        // Remove banned user's messages or mark them
        if (user.userId === currentUser.userId) {
          alert('You have been banned from this channel.');
          handleLogout();
        }
      },
      onUserUnbanned: (channel, user) => {
        console.log('User unbanned:', user);
      },
      onUserMuted: (channel, user) => {
        console.log('User muted:', user);
        if (user.userId === currentUser.userId) {
          alert('You have been muted in this channel.');
        }
      },
      onUserUnmuted: (channel, user) => {
        console.log('User unmuted:', user);
        if (user.userId === currentUser.userId) {
          alert('You have been unmuted in this channel.');
        }
      },
      onChannelFrozen: (channel) => {
        console.log('Channel frozen');
        setChannelFrozen(true);
      },
      onChannelUnfrozen: (channel) => {
        console.log('Channel unfrozen');
        setChannelFrozen(false);
      }
    });

    return () => {
      sendbirdService.removeMessageHandler(handlerId);
    };
  }, [currentUser.userId]);

  const loadUsers = async () => {
    try {
      const applicationUsers = await sendbirdService.getApplicationUsers();
      // Filter out current user
      const otherUsers = applicationUsers.filter(user => user.userId !== currentUser.userId);
      setUsers(otherUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const startChat = async (targetUser) => {
    setLoading(true);
    try {
      // Create or get channel with the selected user
      const userIds = [currentUser.userId, targetUser.userId];
      const channelName = `${currentUser.nickname} & ${targetUser.nickname}`;
      
      const newChannel = await sendbirdService.createOrGetChannel(userIds, channelName);
      setChannel(newChannel);
      setSelectedUser(targetUser);
      
      // Load previous messages
      const previousMessages = await sendbirdService.getPreviousMessages(50);
      setMessages(previousMessages.reverse()); // Reverse to show oldest first
      
      console.log('Channel created/retrieved:', newChannel);
    } catch (error) {
      console.error('Failed to start chat:', error);
      alert('Failed to start chat. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (messageText) => {
    if (!channel || !messageText.trim()) {
      return;
    }

    // Check if user is muted
    try {
      const mutedUsers = await sendbirdService.getMutedUsers();
      const isMuted = mutedUsers.some(user => user.userId === currentUser.userId);
      
      if (isMuted) {
        alert('You are currently muted and cannot send messages.');
        return;
      }
    } catch (error) {
      console.log('Could not check mute status:', error);
    }

    // Check if channel is frozen
    if (channelFrozen && !isOperator) {
      alert('This channel is currently frozen. Only moderators can send messages.');
      return;
    }

    try {
      const message = await sendbirdService.sendMessage(messageText.trim());
      console.log('Message sent:', message);
      // Message will be added to the list via the message handler
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Handle specific errors
      if (error.code === 900020) { // Muted user error code
        alert('You are muted and cannot send messages.');
      } else if (error.code === 900100) { // Banned user error code
        alert('You are banned from this channel.');
      } else {
        alert('Failed to send message. Please try again.');
      }
    }
  };

  const handleMessageDeleted = (deletedMessage) => {
    setMessages(prevMessages => 
      prevMessages.filter(msg => msg.messageId !== deletedMessage.messageId)
    );
  };

  const handleLogout = async () => {
    try {
      await sendbirdService.disconnect();
      onLogout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleMakeOperator = async (targetUserId) => {
    if (!window.confirm('Make this user a moderator?')) {
      return;
    }

    try {
      await sendbirdService.addOperators([targetUserId]);
      alert('User has been made a moderator.');
      loadUsers(); // Refresh to show updated status
    } catch (error) {
      console.error('Failed to add operator:', error);
      alert('Failed to make user a moderator.');
    }
  };

  return (
    <div className="chat-room">
      <div className="chat-header">
        <div className="user-info">
          <span>Welcome, {currentUser.nickname}!</span>
          {isOperator && (
            <span className="moderator-badge">🛡️ Moderator</span>
          )}
          <div className="header-actions">
            {isOperator && (
              <button 
                onClick={() => setShowModerationPanel(true)}
                className="moderation-btn"
                title="Open Moderation Panel"
              >
                🛡️ Moderation
              </button>
            )}
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
        {channel && selectedUser && (
          <div className="channel-info">
            <h3>
              Chatting with {selectedUser.nickname}
              {channelFrozen && (
                <span className="frozen-indicator">❄️ Frozen</span>
              )}
            </h3>
          </div>
        )}
      </div>

      <div className="chat-content">
        <div className="users-panel">
          <UserList 
            users={users} 
            onUserSelect={startChat}
            loading={loading}
            selectedUser={selectedUser}
            currentUser={currentUser}
            isOperator={isOperator}
            onMakeOperator={handleMakeOperator}
          />
        </div>

        <div className="messages-panel">
          {channel ? (
            <>
              <MessageList 
                messages={messages} 
                currentUser={currentUser}
                onMessageDeleted={handleMessageDeleted}
              />
              <MessageInput 
                onSendMessage={sendMessage}
                disabled={loading || (channelFrozen && !isOperator)}
              />
              {channelFrozen && !isOperator && (
                <div className="channel-frozen-notice">
                  ❄️ This channel is frozen. Only moderators can send messages.
                </div>
              )}
            </>
          ) : (
            <div className="no-chat">
              <p>Select a user from the left panel to start chatting!</p>
              <div className="moderation-info">
                <h4>🛡️ Community Guidelines</h4>
                <ul>
                  <li>Be respectful and kind to others</li>
                  <li>No spam, harassment, or inappropriate content</li>
                  <li>Report violations using the report button</li>
                  <li>Moderators are here to help maintain a safe environment</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModerationPanel && (
        <ModerationPanel
          isVisible={showModerationPanel}
          onClose={() => setShowModerationPanel(false)}
        />
      )}
    </div>
  );
};

export default ChatRoom;