// src/components/ChatRoom.js
import React, { useState, useEffect } from 'react';
import MessageList from '../MessageList';
import MessageInput from '../MessageInput';
import sendbirdService from '../../services/sendbirdService';

const ChatRoom = ({ currentUser, onLogout }) => {
  const [channel, setChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentUser) {
      initializeChannel();
    }
    return () => {
      if (channel) {
        channel.exit();
      }
    };
  }, [currentUser]);

  const initializeChannel = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create or get support channel
      const newChannel = await sendbirdService.getOrCreateSupportChannel(currentUser.userId);
      setChannel(newChannel);
      await loadMessages(newChannel);
    } catch (error) {
      console.error('Failed to initialize channel:', error);
      setError('Failed to connect to chat. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (channel) => {
    try {
      const messageList = await sendbirdService.getMessages(channel);
      setMessages(messageList);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendMessage = async (message) => {
    if (!channel || !message.trim()) return;

    try {
      const sentMessage = await sendbirdService.sendMessage(channel, { message });
      setMessages(prev => [...prev, sentMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleSendFile = async (file, fileType) => {
    if (!channel || !file) return;

    try {
      const fileMessage = await sendbirdService.sendFileMessage(channel, file, fileType);
      setMessages(prev => [...prev, fileMessage]);
    } catch (error) {
      console.error('Failed to send file:', error);
      throw error;
    }
  };

  if (loading) {
    return <div className="loading">Loading chat...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="chat-room">
      <div className="chat-header">
        <div className="channel-info">
          <h3>Support Chat</h3>
        </div>
        <div className="user-info">
          <span>{currentUser.nickname}</span>
          <button className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="chat-content">
        <div className="messages-panel">
          <MessageList 
            messages={messages} 
            currentUser={currentUser} 
          />
          <MessageInput 
            onSendMessage={handleSendMessage}
            onSendFile={handleSendFile}
            disabled={!channel}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;