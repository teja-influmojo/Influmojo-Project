// src/components/MessageInput.js
import React, { useState, useRef } from 'react';
import EmojiPicker from './EmojiPicker';
import './MessageInput.css';

const MessageInput = ({ onSendMessage, onSendFile, disabled }) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const documentInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (message.trim() && !disabled && !isUploading) {
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

  const handleEmojiSelect = (emoji) => {
    setMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleFileSelect = async (e, fileType) => {
    const files = Array.from(e.target.files);
    if (!files.length || !onSendFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    try {
      // Show upload progress
      const progressCallback = (status, progress) => {
        console.log(`File upload ${status}: ${progress}%`);
        setUploadProgress(progress);
      };

      if (files.length === 1) {
        // Single file upload
        await onSendFile(files[0], fileType, progressCallback);
      } else {
        // Multiple files upload - handle one at a time
        for (const file of files) {
          try {
            await onSendFile(file, fileType, progressCallback);
          } catch (error) {
            console.error(`Failed to upload file ${file.name}:`, error);
            // Continue with next file even if one fails
          }
        }
      }
    } catch (error) {
      console.error('File upload failed:', error);
      alert('File upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
        e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const fileType = file.type.startsWith('image/') ? 'image' :
                      file.type.startsWith('video/') ? 'video' :
                      file.type.startsWith('audio/') ? 'audio' : 'file';
      handleFileSelect({ target: { files: [file] } }, fileType);
    }
  };

  const triggerFileInput = (inputRef) => {
    inputRef.current?.click();
  };

  const getFileInputAccept = (fileType) => {
    switch (fileType) {
      case 'image':
        return 'image/*';
      case 'video':
        return 'video/*';
      case 'audio':
        return 'audio/*';
      case 'document':
        return '.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx';
      default:
        return '*/*';
    }
  };

      return (
    <div className="message-input">
      <form onSubmit={handleSubmit}>
        <div className="input-container">
          {/* File Upload Area */}
          <div 
            className={`upload-area ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="upload-buttons">
              <button
                type="button"
                onClick={() => triggerFileInput(imageInputRef)}
                disabled={disabled || isUploading}
                className="upload-btn image-btn"
                title="Upload Image"
              >
                <i className="fas fa-image"></i>
                <span>Image</span>
              </button>
              <button
                type="button"
                onClick={() => triggerFileInput(videoInputRef)}
                disabled={disabled || isUploading}
                className="upload-btn video-btn"
                title="Upload Video"
              >
                <i className="fas fa-video"></i>
                <span>Video</span>
              </button>
              <button
                type="button"
                onClick={() => triggerFileInput(audioInputRef)}
                disabled={disabled || isUploading}
                className="upload-btn audio-btn"
                title="Upload Audio"
              >
                <i className="fas fa-music"></i>
                <span>Audio</span>
              </button>
              <button
                type="button"
                onClick={() => triggerFileInput(documentInputRef)}
                disabled={disabled || isUploading}
                className="upload-btn document-btn"
                title="Upload Document"
              >
                <i className="fas fa-file-alt"></i>
                <span>Document</span>
              </button>
              <button
                type="button"
                onClick={() => triggerFileInput(fileInputRef)}
                disabled={disabled || isUploading}
                className="upload-btn file-btn"
                title="Upload File"
              >
                <i className="fas fa-paperclip"></i>
                <span>File</span>
              </button>
              </div>
            <div className="drag-drop-hint">
              <i className="fas fa-cloud-upload-alt"></i>
              <span>Drag & drop files here</span>
            </div>
          </div>
          
          {/* Message Input Area */}
          <div className="text-input-container">
              <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
              placeholder="Type your message here..."
              disabled={disabled || isUploading}
              rows="1"
              className="message-textarea"
            />
            
            {/* Emoji Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={disabled || isUploading}
              className="emoji-btn"
              title="Add Emoji"
            >
              <i className="far fa-smile"></i>
            </button>
                </div>
                
          {/* Send Button */}
                <button 
                  type="submit" 
            disabled={disabled || !message.trim() || isUploading}
                  className="send-button"
                >
            {isUploading ? (
              <div className="upload-progress">
                <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                <span>{uploadProgress}%</span>
              </div>
            ) : (
              <i className="fas fa-paper-plane"></i>
            )}
          </button>
            </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="emoji-picker-container">
            <EmojiPicker 
              onEmojiSelect={handleEmojiSelect}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}
      </form>

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={(e) => handleFileSelect(e, 'file')}
        accept={getFileInputAccept('file')}
        multiple
        style={{ display: 'none' }}
      />
      <input
        ref={imageInputRef}
        type="file"
        onChange={(e) => handleFileSelect(e, 'image')}
        accept={getFileInputAccept('image')}
        multiple
        style={{ display: 'none' }}
      />
      <input
        ref={videoInputRef}
        type="file"
        onChange={(e) => handleFileSelect(e, 'video')}
        accept={getFileInputAccept('video')}
        multiple
        style={{ display: 'none' }}
      />
      <input
        ref={audioInputRef}
        type="file"
        onChange={(e) => handleFileSelect(e, 'audio')}
        accept={getFileInputAccept('audio')}
        multiple
        style={{ display: 'none' }}
      />
      <input
        ref={documentInputRef}
        type="file"
        onChange={(e) => handleFileSelect(e, 'document')}
        accept={getFileInputAccept('document')}
        multiple
        style={{ display: 'none' }}
      />
        </div>
      );
};

export default MessageInput;