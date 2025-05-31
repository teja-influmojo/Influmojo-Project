// src/components/MessageList.js
import React, { useEffect, useRef } from 'react';

const MessageList = ({ messages, currentUser }) => {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isMyMessage = (message) => {
    return message._sender.userId === currentUser.userId;
  };

  return (
    <div className="message-list">
      {messages.length === 0 ? (
        <div className="no-messages">
          <p>No messages yet. Start the conversation!</p>
        </div>
      ) : (
        messages.map((message) => (
          <div
            key={message.messageId}
            className={`message ${isMyMessage(message) ? 'my-message' : 'other-message'}`}
          >
            <div className="message-content">
              <div className="message-header">
                <span className="sender-name">
                  {isMyMessage(message) ? 'You' : message._sender.nickname}
                </span>
                <span className="message-time">
                  {formatTime(message.createdAt)}
                </span>
              </div>
              <div className="message-text">
                {message.message}
              </div>
            </div>
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;