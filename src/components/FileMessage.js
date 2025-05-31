// src/components/FileMessage.js
import React, { useState } from 'react';
import sendbirdService from '../services/sendbirdService';

const FileMessage = ({ message, isMyMessage }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const isImage = () => {
    return message.type && message.type.startsWith('image/');
  };

  const isVideo = () => {
    return message.type && message.type.startsWith('video/');
  };

  const isAudio = () => {
    return message.type && message.type.startsWith('audio/');
  };

  const isDocument = () => {
    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ];
    return message.type && documentTypes.includes(message.type);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = () => {
    if (isImage()) return '🖼️';
    if (isVideo()) return '🎥';
    if (isAudio()) return '🎵';
    if (isDocument()) {
      if (message.type.includes('pdf')) return '📄';
      if (message.type.includes('word')) return '📝';
      if (message.type.includes('excel') || message.type.includes('sheet')) return '📊';
      if (message.type.includes('powerpoint') || message.type.includes('presentation')) return '📋';
      return '📄';
    }
    return '📎';
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const fileData = await sendbirdService.downloadFile(message);
      
      // Create download link
      const link = document.createElement('a');
      link.href = fileData.url;
      link.download = message.name || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      setTimeout(() => {
        URL.revokeObjectURL(fileData.url);
      }, 100);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const renderImageMessage = () => (
    <div className="file-message-container image-container">
      <div className="image-wrapper">
        <img
          src={message.url}
          alt={message.name}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
          className={`message-image ${imageLoaded ? 'loaded' : 'loading'}`}
        />
        {!imageLoaded && (
          <div className="image-placeholder">
            <span>🖼️</span>
            <span>Loading image...</span>
          </div>
        )}
      </div>
      <div className="file-info">
        <span className="file-name">{message.name}</span>
        <div className="file-actions">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="download-btn"
          >
            {isDownloading ? '⏳' : '⬇️'} Download
          </button>
        </div>
      </div>
    </div>
  );

  const renderVideoMessage = () => (
    <div className="file-message-container video-container">
      <div className="video-wrapper">
        <video
          src={message.url}
          controls
          preload="metadata"
          className="message-video"
        >
          Your browser does not support the video tag.
        </video>
      </div>
      <div className="file-info">
        <span className="file-name">{message.name}</span>
        <span className="file-size">{formatFileSize(message.size)}</span>
        <div className="file-actions">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="download-btn"
          >
            {isDownloading ? '⏳' : '⬇️'} Download
          </button>
        </div>
      </div>
    </div>
  );

  const renderAudioMessage = () => (
    <div className="file-message-container audio-container">
      <div className="audio-wrapper">
        <audio
          src={message.url}
          controls
          preload="metadata"
          className="message-audio"
        >
          Your browser does not support the audio tag.
        </audio>
      </div>
      <div className="file-info">
        <span className="file-name">{message.name}</span>
        <span className="file-size">{formatFileSize(message.size)}</span>
        <div className="file-actions">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="download-btn"
          >
            {isDownloading ? '⏳' : '⬇️'} Download
          </button>
        </div>
      </div>
    </div>
  );

  const renderDocumentMessage = () => (
    <div className="file-message-container document-container">
      <div className="document-preview">
        <div className="file-icon">
          {getFileIcon()}
        </div>
        <div className="file-details">
          <span className="file-name">{message.name}</span>
          <span className="file-size">{formatFileSize(message.size)}</span>
          <span className="file-type">{message.type}</span>
        </div>
      </div>
      <div className="file-actions">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="download-btn"
        >
          {isDownloading ? '⏳' : '⬇️'} Download
        </button>
      </div>
    </div>
  );

  const renderGenericFileMessage = () => (
    <div className="file-message-container generic-container">
      <div className="file-preview">
        <div className="file-icon">
          {getFileIcon()}
        </div>
        <div className="file-details">
          <span className="file-name">{message.name}</span>
          <span className="file-size">{formatFileSize(message.size)}</span>
          {message.type && <span className="file-type">{message.type}</span>}
        </div>
      </div>
      <div className="file-actions">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="download-btn"
        >
          {isDownloading ? '⏳' : '⬇️'} Download
        </button>
      </div>
    </div>
  );

  // Render appropriate message type
  if (isImage()) {
    return renderImageMessage();
  } else if (isVideo()) {
    return renderVideoMessage();
  } else if (isAudio()) {
    return renderAudioMessage();
  } else if (isDocument()) {
    return renderDocumentMessage();
  } else {
    return renderGenericFileMessage();
  }
};

export default FileMessage;