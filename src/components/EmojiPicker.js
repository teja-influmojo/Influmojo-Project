import React, { useEffect, useRef } from 'react';
import './EmojiPicker.css';

const EmojiPicker = ({ onEmojiSelect, onClose }) => {
  const pickerRef = useRef(null);

  const emojis = [
    { key: 'smile', emoji: '😊', label: 'Smile' },
    { key: 'heart', emoji: '❤️', label: 'Heart' },
    { key: 'thumbs_up', emoji: '👍', label: 'Thumbs Up' },
    { key: 'thumbs_down', emoji: '👎', label: 'Thumbs Down' },
    { key: 'laugh', emoji: '😂', label: 'Laugh' },
    { key: 'wow', emoji: '😮', label: 'Wow' },
    { key: 'sad', emoji: '😢', label: 'Sad' },
    { key: 'angry', emoji: '😠', label: 'Angry' },
    { key: 'fire', emoji: '🔥', label: 'Fire' },
    { key: 'party', emoji: '🎉', label: 'Party' },
    { key: 'clap', emoji: '👏', label: 'Clap' },
    { key: 'eyes', emoji: '👀', label: 'Eyes' }
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

  const handleEmojiClick = (emojiKey) => {
    onEmojiSelect(emojiKey);
    onClose();
  };

  return (
    <div className="emoji-picker-overlay">
      <div ref={pickerRef} className="emoji-picker">
        <div className="emoji-picker-header">
          <span>Choose a reaction</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="emoji-grid">
          {emojis.map((emoji) => (
            <button
              key={emoji.key}
              className="emoji-option"
              onClick={() => handleEmojiClick(emoji.key)}
              title={emoji.label}
            >
              {emoji.emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmojiPicker;