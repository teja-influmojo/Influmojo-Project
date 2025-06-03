// src/components/MessageList.js
import React, { useEffect, useRef } from 'react';

const MessageList = ({ messages, currentUser, onMessageClick }) => {
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
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType, mimeType) => {
    if (mimeType?.startsWith('image/')) return '🖼️';
    if (mimeType?.startsWith('video/')) return '🎥';
    if (mimeType?.startsWith('audio/')) return '🎵';
    if (mimeType?.includes('pdf')) return '📄';
    if (mimeType?.includes('document') || mimeType?.includes('word')) return '📝';
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return '📊';
    if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) return '📽️';
    return '📎';
  };

  const renderFileMessage = (message) => {
    const fileUrl = message.url;
    const fileName = message.name || 'Unknown file';
    const fileSize = message.size;
    const mimeType = message.type;

    // Check if it's an image
    if (mimeType && mimeType.startsWith('image/')) {
      return (
        <div className="file-message image-message">
          <img 
            src={fileUrl} 
            alt={fileName}
            className="message-image"
            style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
            onClick={() => window.open(fileUrl, '_blank')}
          />
          <div className="file-info">
            <span className="file-name">{fileName}</span>
            <span className="file-size">{formatFileSize(fileSize)}</span>
          </div>
        </div>
      );
    }

    // Check if it's a video
    if (mimeType && mimeType.startsWith('video/')) {
      return (
        <div className="file-message video-message">
          <video 
            controls 
            style={{ maxWidth: '300px', maxHeight: '200px', borderRadius: '8px' }}
          >
            <source src={fileUrl} type={mimeType} />
            Your browser does not support the video tag.
          </video>
          <div className="file-info">
            <span className="file-name">{fileName}</span>
            <span className="file-size">{formatFileSize(fileSize)}</span>
      </div>
        </div>
      );
    }
    
    // Check if it's audio
    if (mimeType && mimeType.startsWith('audio/')) {
      return (
        <div className="file-message audio-message">
          <audio controls style={{ width: '250px' }}>
            <source src={fileUrl} type={mimeType} />
            Your browser does not support the audio tag.
          </audio>
          <div className="file-info">
            <span className="file-name">{fileName}</span>
            <span className="file-size">{formatFileSize(fileSize)}</span>
          </div>
        </div>
      );
    }

    // Generic file
    return (
      <div className="file-message generic-file">
        <div className="file-download" onClick={() => window.open(fileUrl, '_blank')}>
          <div className="file-icon">
            {getFileIcon(null, mimeType)}
          </div>
          <div className="file-details">
            <div className="file-name">{fileName}</div>
            <div className="file-size">{formatFileSize(fileSize)}</div>
          </div>
          <div className="download-icon">⬇️</div>
        </div>
      </div>
    );
  };

  const renderMessage = (message) => {
    const isCurrentUser = message._sender.userId === currentUser.userId;
    
    // Check if the message is profanity filtered (contains only asterisks)
    const isProfanityFiltered = /^[\*]+$/.test(message.message);

    const messageClass = `message ${isCurrentUser ? 'sent' : 'received'} ${isProfanityFiltered ? 'profanity-warning' : ''}`;

    // Check if it's a file message
    const isFileMessage = message.messageType === 'file';

    return (
      <div 
        key={message.messageId || message.reqId} 
        className={messageClass}
        onClick={() => onMessageClick && onMessageClick(message)}
        style={{ cursor: 'pointer' }}
      >
        <div className="message-content">
          <div className="message-header">
            <span className="sender-name">
              {isCurrentUser ? 'You' : message._sender.nickname}
            </span>
            <span className="message-time">
              {formatTime(message.createdAt)}
            </span>
          </div>
          
          <div className="message-body">
            {isFileMessage ? (
              renderFileMessage(message)
            ) : (
              <div className="text-message">
            {message.message}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="message-list">
      {messages.length === 0 ? (
        <div className="no-messages">
          <p>No messages yet. Start the conversation!</p>
        </div>
      ) : (
        messages.map((message) => renderMessage(message))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;