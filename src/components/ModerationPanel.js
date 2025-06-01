// src/components/ModerationPanel.js
import React, { useState, useEffect } from 'react';
import sendbirdService from '../services/sendbirdService';

const ModerationPanel = ({ message, channel, currentUser, onClose, onModerationAction }) => {
  const [reportCategory, setReportCategory] = useState('spam');
  const [reportDescription, setReportDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('report');
  const [banDuration, setBanDuration] = useState(-1); // -1 for permanent
  const [muteDuration, setMuteDuration] = useState(-1);
  const [moderationReason, setModerationReason] = useState('');
  const [bannedUsers, setBannedUsers] = useState([]);
  const [mutedUsers, setMutedUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [hasModerationRights, setHasModerationRights] = useState(false);
  const [isOperator, setIsOperator] = useState(false);

  const reportCategories = [
    { value: 'spam', label: 'Spam' },
    { value: 'harassing', label: 'Harassment' },
    { value: 'inappropriate', label: 'Inappropriate Content' },
    { value: 'violence', label: 'Violence' },
    { value: 'hate_speech', label: 'Hate Speech' },
    { value: 'other', label: 'Other' }
  ];

  const durationOptions = [
    { value: -1, label: 'Permanent' },
    { value: 300, label: '5 minutes' },
    { value: 1800, label: '30 minutes' },
    { value: 3600, label: '1 hour' },
    { value: 86400, label: '24 hours' },
    { value: 604800, label: '7 days' },
    { value: 2592000, label: '30 days' }
  ];

  // Check moderation permissions when component mounts or channel changes
  useEffect(() => {
    if (channel && currentUser) {
      const canModerate = sendbirdService.canModerate(channel);
      const isOperator = sendbirdService.isCurrentUserOperator(channel);
      setHasModerationRights(canModerate);
      setIsOperator(isOperator);
    }
  }, [channel, currentUser]);

  // Load banned and muted users when component mounts
  useEffect(() => {
    if (hasModerationRights && channel && activeTab === 'manage') {
      loadModerationLists();
    }
  }, [activeTab, hasModerationRights, channel]);

  const loadModerationLists = async () => {
    if (!channel) return;
    
    setLoadingUsers(true);
    try {
      const [banned, muted] = await Promise.all([
        sendbirdService.getBannedUsers(channel),
        sendbirdService.getMutedUsers(channel)
      ]);
      setBannedUsers(banned);
      setMutedUsers(muted);
    } catch (error) {
      console.error('Failed to load moderation lists:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleReportMessage = async () => {
    if (!message) return;
    
    setLoading(true);
    try {
      await sendbirdService.reportMessage(message, reportCategory, reportDescription);
      alert('Message reported successfully');
      onModerationAction?.('report', { type: 'message', messageId: message.messageId });
      onClose();
    } catch (error) {
      console.error('Failed to report message:', error);
      alert('Failed to report message: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReportUser = async () => {
    if (!message?._sender) return;
    
    setLoading(true);
    try {
      await sendbirdService.reportUser(message._sender.userId, reportCategory, reportDescription);
      alert('User reported successfully');
      onModerationAction?.('report', { type: 'user', userId: message._sender.userId });
      onClose();
    } catch (error) {
      console.error('Failed to report user:', error);
      alert('Failed to report user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReportChannel = async () => {
    if (!channel) return;
    
    setLoading(true);
    try {
      await sendbirdService.reportChannel(channel, reportCategory, reportDescription);
      alert('Channel reported successfully');
      onModerationAction?.('report', { type: 'channel', channelUrl: channel.url });
      onClose();
    } catch (error) {
      console.error('Failed to report channel:', error);
      alert('Failed to report channel: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!message) return;
    
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    
    setLoading(true);
    try {
      await sendbirdService.deleteMessage(message);
      alert('Message deleted successfully');
      onModerationAction?.('delete', { messageId: message.messageId });
      onClose();
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async () => {
    if (!message?._sender || !channel) return;
    
    if (!window.confirm(`Are you sure you want to ban ${message._sender.nickname || message._sender.userId}?`)) return;
    
    setLoading(true);
    try {
      await sendbirdService.banUser(channel, message._sender.userId, moderationReason, banDuration);
      alert('User banned successfully');
      onModerationAction?.('ban', { userId: message._sender.userId, duration: banDuration });
      loadModerationLists(); // Refresh the lists
    } catch (error) {
      console.error('Failed to ban user:', error);
      alert('Failed to ban user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnbanUser = async (userId) => {
    if (!channel) return;
    
    if (!window.confirm('Are you sure you want to unban this user?')) return;
    
    setLoading(true);
    try {
      await sendbirdService.unbanUser(channel, userId);
      alert('User unbanned successfully');
      onModerationAction?.('unban', { userId });
      loadModerationLists(); // Refresh the lists
    } catch (error) {
      console.error('Failed to unban user:', error);
      alert('Failed to unban user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMuteUser = async () => {
    if (!message?._sender || !channel) return;
    
    if (!window.confirm(`Are you sure you want to mute ${message._sender.nickname || message._sender.userId}?`)) return;
    
    setLoading(true);
    try {
      await sendbirdService.muteUser(channel, message._sender.userId, moderationReason, muteDuration);
      alert('User muted successfully');
      onModerationAction?.('mute', { userId: message._sender.userId, duration: muteDuration });
      loadModerationLists(); // Refresh the lists
    } catch (error) {
      console.error('Failed to mute user:', error);
      alert('Failed to mute user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnmuteUser = async (userId) => {
    if (!channel) return;
    
    if (!window.confirm('Are you sure you want to unmute this user?')) return;
    
    setLoading(true);
    try {
      await sendbirdService.unmuteUser(channel, userId);
      alert('User unmuted successfully');
      onModerationAction?.('unmute', { userId });
      loadModerationLists(); // Refresh the lists
    } catch (error) {
      console.error('Failed to unmute user:', error);
      alert('Failed to unmute user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderReportTab = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Report Category
        </label>
        <select
          value={reportCategory}
          onChange={(e) => setReportCategory(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {reportCategories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description (Optional)
        </label>
        <textarea
          value={reportDescription}
          onChange={(e) => setReportDescription(e.target.value)}
          placeholder="Provide additional details about the issue..."
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows="3"
        />
      </div>

      <div className="flex flex-col space-y-2">
        {message && (
          <button
            onClick={handleReportMessage}
            disabled={loading}
            className="w-full bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 disabled:opacity-50"
          >
            {loading ? 'Reporting...' : 'Report Message'}
          </button>
        )}

        {message?._sender && (
          <button
            onClick={handleReportUser}
            disabled={loading}
            className="w-full bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? 'Reporting...' : `Report User: ${message._sender.nickname || message._sender.userId}`}
          </button>
        )}

        <button
          onClick={handleReportChannel}
          disabled={loading}
          className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Reporting...' : 'Report Channel'}
        </button>
      </div>
    </div>
  );

  const renderModerationTab = () => (
    <div className="space-y-4">
      {message?._sender && (
        <>
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm font-medium">User: {message._sender.nickname || message._sender.userId}</p>
            <p className="text-xs text-gray-600">Message: "{message.message}"</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Moderation Reason
            </label>
            <textarea
              value={moderationReason}
              onChange={(e) => setModerationReason(e.target.value)}
              placeholder="Enter reason for moderation action..."
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="2"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDeleteMessage}
              disabled={loading}
              className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
            >
              Delete Message
            </button>

            <button
              onClick={handleBanUser}
              disabled={loading}
              className="bg-red-800 text-white px-3 py-2 rounded-md hover:bg-red-900 disabled:opacity-50 text-sm"
            >
              Ban User
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ban Duration
              </label>
              <select
                value={banDuration}
                onChange={(e) => setBanDuration(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {durationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mute Duration
              </label>
              <select
                value={muteDuration}
                onChange={(e) => setMuteDuration(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {durationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleMuteUser}
              disabled={loading}
              className="w-full bg-yellow-600 text-white px-3 py-2 rounded-md hover:bg-yellow-700 disabled:opacity-50 text-sm"
            >
              Mute User
            </button>
          </div>
        </>
      )}
    </div>
  );

  const renderManageTab = () => (
    <div className="space-y-4">
      {loadingUsers ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-600 mt-2">Loading moderation lists...</p>
        </div>
      ) : (
        <>
          <div>
            <h4 className="font-medium text-gray-900 mb-2 flex items-center justify-between">
              Banned Users ({bannedUsers.length})
              <button
                onClick={loadModerationLists}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Refresh
              </button>
            </h4>
            {bannedUsers.length === 0 ? (
              <p className="text-sm text-gray-500 bg-gray-50 p-2 rounded">No banned users</p>
            ) : (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {bannedUsers.map((user) => (
                  <div key={user.userId} className="flex items-center justify-between bg-red-50 p-2 rounded text-sm">
                    <span>{user.nickname || user.userId}</span>
                    <button
                      onClick={() => handleUnbanUser(user.userId)}
                      disabled={loading}
                      className="text-green-600 hover:text-green-800 text-xs px-2 py-1 bg-white rounded border"
                    >
                      Unban
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Muted Users ({mutedUsers.length})</h4>
            {mutedUsers.length === 0 ? (
              <p className="text-sm text-gray-500 bg-gray-50 p-2 rounded">No muted users</p>
            ) : (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {mutedUsers.map((user) => (
                  <div key={user.userId} className="flex items-center justify-between bg-yellow-50 p-2 rounded text-sm">
                    <span>{user.nickname || user.userId}</span>
                    <button
                      onClick={() => handleUnmuteUser(user.userId)}
                      disabled={loading}
                      className="text-green-600 hover:text-green-800 text-xs px-2 py-1 bg-white rounded border"
                    >
                      Unmute
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Moderation Panel</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('report')}
            className={`flex-1 py-2 px-4 text-sm font-medium ${
              activeTab === 'report'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Report
          </button>
          {hasModerationRights && (
            <>
              <button
                onClick={() => setActiveTab('moderate')}
                className={`flex-1 py-2 px-4 text-sm font-medium ${
                  activeTab === 'moderate'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Moderate
              </button>
              <button
                onClick={() => setActiveTab('manage')}
                className={`flex-1 py-2 px-4 text-sm font-medium ${
                  activeTab === 'manage'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Manage
              </button>
            </>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {activeTab === 'report' && renderReportTab()}
          {activeTab === 'moderate' && hasModerationRights && renderModerationTab()}
          {activeTab === 'manage' && hasModerationRights && renderManageTab()}
          
          {!hasModerationRights && activeTab !== 'report' && (
            <div className="text-center py-8">
              <p className="text-gray-500">You don't have moderation privileges in this channel.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>
              {hasModerationRights ? `Operator: ${isOperator ? 'Yes' : 'No'}` : 'User'}
            </span>
            <span>
              Channel: {channel ? sendbirdService.getChannelDisplayName(channel) : 'Unknown'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModerationPanel;