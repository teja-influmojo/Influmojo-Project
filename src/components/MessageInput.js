// src/components/MessageInput.js
import React, { useState } from 'react';

const MessageInput = ({ onSendMessage, disabled }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="message-input">
      <form onSubmit={handleSubmit}>
        <div className="input-container">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            disabled={disabled}
            rows="1"
            className="message-textarea"
          />
          <button 
            type="submit" 
            disabled={disabled || !message.trim()}
            className="send-button"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default MessageInput;