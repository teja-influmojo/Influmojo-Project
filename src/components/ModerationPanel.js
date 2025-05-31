// src/components/ModerationPanel.js
import React, { useState, useEffect } from 'react';
import sendbirdService from '../services/sendbirdService';
import moderationService from '../services/moderationService';

const createModerationPanel = () => {
  // Private state (closure variables)
  let moderationStats = {
    bannedCount: 0,
    mutedCount: 0,
    bannedUsers: [],
    mutedUsers: []
  };
  let loading = false;
  let channelFrozen = false;
  let activeTab = 'overview';

  // Private methods
  const loadModerationData = async () => {
    loading = true;
    try {
      const stats = await moderationService.getModerationStats();
      moderationStats = stats;
    } catch (error) {
      console.error('Failed to load moderation data:', error);
    } finally {
      loading = false;
    }
  };

  const checkChannelStatus = () => {
    if (sendbirdService.currentChannel) {
      channelFrozen = sendbirdService.currentChannel.isFrozen;
    }
  };

  const handleUnbanUser = async (userId, nickname) => {
    if (!window.confirm(`Are you sure you want to unban ${nickname}?`)) {
      return;
    }

    try {
      await sendbirdService.unbanUser(userId);
      alert(`${nickname} has been unbanned.`);
      await loadModerationData(); // Refresh data
    } catch (error) {
      console.error('Failed to unban user:', error);
      alert('Failed to unban user. Please try again.');
    }
  };

  const handleUnmuteUser = async (userId, nickname) => {
    if (!window.confirm(`Are you sure you want to unmute ${nickname}?`)) {
      return;
    }

    try {
      await sendbirdService.unmuteUser(userId);
      alert(`${nickname} has been unmuted.`);
      await loadModerationData(); // Refresh data
    } catch (error) {
      console.error('Failed to unmute user:', error);
      alert('Failed to unmute user. Please try again.');
    }
  };

  const handleFreezeChannel = async () => {
    try {
      if (channelFrozen) {
        await sendbirdService.unfreezeChannel();
        channelFrozen = false;
        alert('Channel has been unfrozen. Users can now send messages.');
      } else {
        await sendbirdService.freezeChannel();
        channelFrozen = true;
        alert('Channel has been frozen. Users cannot send messages.');
      }
    } catch (error) {
      console.error('Failed to toggle channel freeze:', error);
      alert('Failed to update channel status. Please try again.');
    }
  };

  const formatDuration = (seconds) => {
    if (seconds === -1) return 'Permanent';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const renderOverviewTab = () => (
    <div className="moderation-overview">
      <div className="stats-grid">
        <div className="stat-card">
          <h4>Banned Users</h4>
          <div className="stat-number">{moderationStats.bannedCount}</div>
        </div>
        <div className="stat-card">
          <h4>Muted Users</h4>
          <div className="stat-number">{moderationStats.mutedCount}</div>
        </div>
        <div className="stat-card">
          <h4>Channel Status</h4>
          <div className="stat-status">
            {channelFrozen ? (
              <span className="status-frozen">❄️ Frozen</span>
            ) : (
              <span className="status-active">✅ Active</span>
            )}
          </div>
        </div>
      </div>
      
      <div className="quick-actions">
        <h4>Quick Actions</h4>
        <button 
          className={`btn ${channelFrozen ? 'btn-success' : 'btn-warning'}`}
          onClick={handleFreezeChannel}
        >
          {channelFrozen ? 'Unfreeze Channel' : 'Freeze Channel'}
        </button>
        <button 
          className="btn btn-secondary"
          onClick={loadModerationData}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
    </div>
  );

  const renderBannedUsersTab = () => (
    <div className="banned-users">
      <h4>Banned Users ({moderationStats.bannedCount})</h4>
      {moderationStats.bannedUsers.length === 0 ? (
        <p className="no-data">No banned users</p>
      ) : (
        <div className="user-list">
          {moderationStats.bannedUsers.map(user => (
            <div key={user.userId} className="user-item banned-user">
              <div className="user-info">
                <strong>{user.nickname || user.userId}</strong>
                <div className="user-details">
                  <span>User ID: {user.userId}</span>
                  {user.description && (
                    <span>Reason: {user.description}</span>
                  )}
                </div>
              </div>
              <button 
                className="btn btn-success btn-sm"
                onClick={() => handleUnbanUser(user.userId, user.nickname || user.userId)}
              >
                Unban
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMutedUsersTab = () => (
    <div className="muted-users">
      <h4>Muted Users ({moderationStats.mutedCount})</h4>
      {moderationStats.mutedUsers.length === 0 ? (
        <p className="no-data">No muted users</p>
      ) : (
        <div className="user-list">
          {moderationStats.mutedUsers.map(user => (
            <div key={user.userId} className="user-item muted-user">
              <div className="user-info">
                <strong>{user.nickname || user.userId}</strong>
                <div className="user-details">
                  <span>User ID: {user.userId}</span>
                  {user.description && (
                    <span>Reason: {user.description}</span>
                  )}
                  {user.remainingDuration && (
                    <span>Remaining: {formatDuration(user.remainingDuration)}</span>
                  )}
                </div>
              </div>
              <button 
                className="btn btn-success btn-sm"
                onClick={() => handleUnmuteUser(user.userId, user.nickname || user.userId)}
              >
                Unmute
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSettingsTab = () => {
    const presets = moderationService.getModerationPresets();
    
    return (
      <div className="moderation-settings">
        <h4>Moderation Settings</h4>
        
        <div className="settings-section">
          <h5>Auto-Moderation</h5>
          <div className="setting-item">
            <label>
              <input type="checkbox" defaultChecked />
              Enable profanity filter
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input type="checkbox" defaultChecked />
              Block spam messages
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input type="checkbox" defaultChecked />
              Flag excessive caps
            </label>
          </div>
        </div>
        
        <div className="settings-section">
          <h5>Quick Ban Reasons</h5>
          <div className="preset-list">
            {presets.banReasons.map((reason, index) => (
              <div key={index} className="preset-item">
                {reason}
              </div>
            ))}
          </div>
        </div>
        
        <div className="settings-section">
          <h5>Quick Mute Reasons</h5>
          <div className="preset-list">
            {presets.muteReasons.map((reason, index) => (
              <div key={index} className="preset-item">
                {reason}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Public API
  return {
    // Initialize moderation panel data
    initialize: async () => {
      await loadModerationData();
      checkChannelStatus();
    },

    // Get current moderation stats
    getModerationStats: () => ({ ...moderationStats }),

    // Get current channel status
    getChannelStatus: () => channelFrozen,

    // Set active tab
    setActiveTab: (tab) => {
      activeTab = tab;
    },

    // Get active tab
    getActiveTab: () => activeTab,

    // Refresh moderation data
    refreshData: loadModerationData,

    // React component
    Component: ({ isVisible, onClose }) => {
      const [, forceUpdate] = useState({});
      const [localActiveTab, setLocalActiveTab] = useState(activeTab);
      const [localModerationStats, setLocalModerationStats] = useState(moderationStats);
      const [localLoading, setLocalLoading] = useState(loading);
      const [localChannelFrozen, setLocalChannelFrozen] = useState(channelFrozen);

      // Force re-render function
      const rerender = () => forceUpdate({});

      useEffect(() => {
        if (isVisible) {
          const initializePanel = async () => {
            setLocalLoading(true);
            await loadModerationData();
            checkChannelStatus();
            setLocalModerationStats({ ...moderationStats });
            setLocalChannelFrozen(channelFrozen);
            setLocalLoading(false);
          };
          initializePanel();
        }
      }, [isVisible]);

      const handleTabClick = (tab) => {
        activeTab = tab;
        setLocalActiveTab(tab);
      };

      const handleRefreshData = async () => {
        setLocalLoading(true);
        await loadModerationData();
        setLocalModerationStats({ ...moderationStats });
        setLocalLoading(false);
      };

      const handleChannelFreeze = async () => {
        await handleFreezeChannel();
        setLocalChannelFrozen(channelFrozen);
      };

      const handleUserUnban = async (userId, nickname) => {
        await handleUnbanUser(userId, nickname);
        await handleRefreshData();
      };

      const handleUserUnmute = async (userId, nickname) => {
        await handleUnmuteUser(userId, nickname);
        await handleRefreshData();
      };

      if (!isVisible) {
        return null;
      }

      return (
        <div className="moderation-panel-backdrop">
          <div className="moderation-panel">
            <div className="panel-header">
              <h3>🛡️ Moderation Panel</h3>
              <button className="close-btn" onClick={onClose}>&times;</button>
            </div>
            
            <div className="panel-tabs">
              <button 
                className={`tab-btn ${localActiveTab === 'overview' ? 'active' : ''}`}
                onClick={() => handleTabClick('overview')}
              >
                Overview
              </button>
              <button 
                className={`tab-btn ${localActiveTab === 'banned' ? 'active' : ''}`}
                onClick={() => handleTabClick('banned')}
              >
                Banned Users
              </button>
              <button 
                className={`tab-btn ${localActiveTab === 'muted' ? 'active' : ''}`}
                onClick={() => handleTabClick('muted')}
              >
                Muted Users
              </button>
              <button 
                className={`tab-btn ${localActiveTab === 'settings' ? 'active' : ''}`}
                onClick={() => handleTabClick('settings')}
              >
                Settings
              </button>
            </div>
            
            <div className="panel-content">
              {localLoading && <div className="loading">Loading moderation data...</div>}
              
              {localActiveTab === 'overview' && (
                <div className="moderation-overview">
                  <div className="stats-grid">
                    <div className="stat-card">
                      <h4>Banned Users</h4>
                      <div className="stat-number">{localModerationStats.bannedCount}</div>
                    </div>
                    <div className="stat-card">
                      <h4>Muted Users</h4>
                      <div className="stat-number">{localModerationStats.mutedCount}</div>
                    </div>
                    <div className="stat-card">
                      <h4>Channel Status</h4>
                      <div className="stat-status">
                        {localChannelFrozen ? (
                          <span className="status-frozen">❄️ Frozen</span>
                        ) : (
                          <span className="status-active">✅ Active</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="quick-actions">
                    <h4>Quick Actions</h4>
                    <button 
                      className={`btn ${localChannelFrozen ? 'btn-success' : 'btn-warning'}`}
                      onClick={handleChannelFreeze}
                    >
                      {localChannelFrozen ? 'Unfreeze Channel' : 'Freeze Channel'}
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={handleRefreshData}
                      disabled={localLoading}
                    >
                      {localLoading ? 'Refreshing...' : 'Refresh Data'}
                    </button>
                  </div>
                </div>
              )}

              {localActiveTab === 'banned' && (
                <div className="banned-users">
                  <h4>Banned Users ({localModerationStats.bannedCount})</h4>
                  {localModerationStats.bannedUsers.length === 0 ? (
                    <p className="no-data">No banned users</p>
                  ) : (
                    <div className="user-list">
                      {localModerationStats.bannedUsers.map(user => (
                        <div key={user.userId} className="user-item banned-user">
                          <div className="user-info">
                            <strong>{user.nickname || user.userId}</strong>
                            <div className="user-details">
                              <span>User ID: {user.userId}</span>
                              {user.description && (
                                <span>Reason: {user.description}</span>
                              )}
                            </div>
                          </div>
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={() => handleUserUnban(user.userId, user.nickname || user.userId)}
                          >
                            Unban
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {localActiveTab === 'muted' && (
                <div className="muted-users">
                  <h4>Muted Users ({localModerationStats.mutedCount})</h4>
                  {localModerationStats.mutedUsers.length === 0 ? (
                    <p className="no-data">No muted users</p>
                  ) : (
                    <div className="user-list">
                      {localModerationStats.mutedUsers.map(user => (
                        <div key={user.userId} className="user-item muted-user">
                          <div className="user-info">
                            <strong>{user.nickname || user.userId}</strong>
                            <div className="user-details">
                              <span>User ID: {user.userId}</span>
                              {user.description && (
                                <span>Reason: {user.description}</span>
                              )}
                              {user.remainingDuration && (
                                <span>Remaining: {formatDuration(user.remainingDuration)}</span>
                              )}
                            </div>
                          </div>
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={() => handleUserUnmute(user.userId, user.nickname || user.userId)}
                          >
                            Unmute
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {localActiveTab === 'settings' && renderSettingsTab()}
            </div>
          </div>
        </div>
      );
    }
  };
};

// Create and export the moderation panel instance
const moderationPanel = createModerationPanel();

// Export both the instance and the component
export default moderationPanel;
export const ModerationPanel = moderationPanel.Component;