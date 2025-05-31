// src/components/AgentJoinRequest.js
import React, { useState, useEffect } from 'react';
import sendbirdService from '../services/sendbirdService';

const AgentJoinRequest = ({ currentUser, targetChannel, onRequestSent, onCancel }) => {
  const [requestMessage, setRequestMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const sendJoinRequest = async () => {
    if (!requestMessage.trim()) {
      alert('Please enter a reason for joining the conversation.');
      return;
    }

    setLoading(true);
    try {
      // Send a special message to the channel indicating join request
      const requestData = {
        agentId: currentUser.userId,
        agentName: currentUser.nickname,
        reason: requestMessage.trim(),
        timestamp: Date.now()
      };

      // Send message with custom type for join request
      await sendbirdService.sendJoinRequest(targetChannel.url, requestData);
      
      // Also send to admin if admin exists
      try {
        await sendbirdService.sendJoinRequestToAdmin(requestData, targetChannel);
      } catch (error) {
        console.warn('Could not notify admin:', error);
      }

      onRequestSent();
      alert('Join request sent successfully!');
    } catch (error) {
      console.error('Failed to send join request:', error);
      alert('Failed to send join request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="join-request-modal">
      <div className="modal-overlay" onClick={onCancel}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Request to Join Conversation</h3>
            <button className="close-btn" onClick={onCancel}>×</button>
          </div>
          
          <div className="modal-body">
            <p>You are requesting to join the conversation in:</p>
            <div className="channel-info">
              <strong>{sendbirdService.getChannelDisplayName(targetChannel)}</strong>
            </div>
            
            <div className="form-group">
              <label htmlFor="requestReason">Reason for joining:</label>
              <textarea
                id="requestReason"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Please provide a reason for joining this conversation..."
                rows={4}
                maxLength={500}
              />
              <div className="char-count">
                {requestMessage.length}/500
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button 
              onClick={onCancel}
              className="cancel-btn"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              onClick={sendJoinRequest}
              className="send-request-btn"
              disabled={loading || !requestMessage.trim()}
            >
              {loading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentJoinRequest;