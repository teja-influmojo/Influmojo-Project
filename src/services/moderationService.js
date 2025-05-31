// src/services/moderationService.js
import sendbirdService from './sendbirdService';

const createModerationService = () => {
  // Private state (closure variables)
  const reportCategories = {
    SPAM: 'spam',
    HARASSMENT: 'harassing',
    INAPPROPRIATE: 'inappropriate',
    SUSPICIOUS: 'suspicious'
  };

  // Profanity filter - basic implementation
  const profanityWords = [
    // Add your profanity words here - keeping it minimal for example
    'badword1', 'badword2', 'spam', 'stupid'
  ];

  // Simple profanity filter
  const containsProfanity = (message) => {
    const lowerMessage = message.toLowerCase();
    return profanityWords.some(word => 
      lowerMessage.includes(word.toLowerCase())
    );
  };

  // Filter message content
  const filterMessage = (message) => {
    let filteredMessage = message;
    
    profanityWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      filteredMessage = filteredMessage.replace(regex, '*'.repeat(word.length));
    });
    
    return filteredMessage;
  };

  // Check if message should be blocked
  const shouldBlockMessage = (message) => {
    // Check for spam (repeated characters)
    const hasRepeatedChars = /(.)\1{10,}/.test(message);
    
    // Check for excessive caps
    const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;
    const hasExcessiveCaps = capsRatio > 0.7 && message.length > 10;
    
    // Check for profanity
    const hasProfanity = containsProfanity(message);
    
    return hasRepeatedChars || hasExcessiveCaps || hasProfanity;
  };

  // Auto-moderate message
  const autoModerateMessage = (message) => {
    const violations = [];
    
    if (containsProfanity(message)) {
      violations.push('profanity');
    }
    
    if (/(.)\1{10,}/.test(message)) {
      violations.push('spam_chars');
    }
    
    const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;
    if (capsRatio > 0.7 && message.length > 10) {
      violations.push('excessive_caps');
    }
    
    return {
      shouldBlock: violations.length > 0,
      violations,
      filteredMessage: filterMessage(message)
    };
  };

  // Ban user with reason
  const banUserWithReason = async (userId, reason, duration = -1) => {
    try {
      const response = await sendbirdService.banUser(userId, reason, duration);
      logModerationAction('BAN', userId, reason);
      return response;
    } catch (error) {
      console.error('Failed to ban user:', error);
      throw error;
    }
  };

  // Mute user with reason
  const muteUserWithReason = async (userId, reason, duration = -1) => {
    try {
      const response = await sendbirdService.muteUser(userId, reason, duration);
      logModerationAction('MUTE', userId, reason);
      return response;
    } catch (error) {
      console.error('Failed to mute user:', error);
      throw error;
    }
  };

  // Delete message with logging
  const deleteMessageWithReason = async (message, reason) => {
    try {
      const response = await sendbirdService.deleteMessage(message);
      logModerationAction('DELETE_MESSAGE', message._sender.userId, reason, {
        messageId: message.messageId,
        messageContent: message.message
      });
      return response;
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  };

  // Report content
  const reportContent = async (type, target, category, description) => {
    try {
      let response;
      
      if (type === 'message') {
        response = await sendbirdService.reportMessage(target, category, description);
      } else if (type === 'user') {
        response = await sendbirdService.reportUser(target, category, description);
      }
      
      logModerationAction('REPORT', target, `${category}: ${description}`);
      return response;
    } catch (error) {
      console.error('Failed to report content:', error);
      throw error;
    }
  };

  // Get moderation statistics
  const getModerationStats = async () => {
    try {
      const [bannedUsers, mutedUsers] = await Promise.all([
        sendbirdService.getBannedUsers(),
        sendbirdService.getMutedUsers()
      ]);
      
      return {
        bannedCount: bannedUsers.length,
        mutedCount: mutedUsers.length,
        bannedUsers,
        mutedUsers
      };
    } catch (error) {
      console.error('Failed to get moderation stats:', error);
      return {
        bannedCount: 0,
        mutedCount: 0,
        bannedUsers: [],
        mutedUsers: []
      };
    }
  };

  // Log moderation actions (in production, send to your backend)
  const logModerationAction = (action, targetUserId, reason, metadata = {}) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      moderatorId: sendbirdService.currentUser?.userId,
      targetUserId,
      reason,
      metadata
    };
    
    console.log('Moderation Action:', logEntry);
    
    // In production, you would send this to your backend:
    // sendToBackend(logEntry);
  };

  // Get user warnings count (stored locally for demo)
  const getUserWarnings = (userId) => {
    const warnings = localStorage.getItem(`warnings_${userId}`);
    return warnings ? parseInt(warnings) : 0;
  };

  // Add warning to user
  const addUserWarning = (userId, reason) => {
    const currentWarnings = getUserWarnings(userId);
    const newWarnings = currentWarnings + 1;
    localStorage.setItem(`warnings_${userId}`, newWarnings.toString());
    
    logModerationAction('WARNING', userId, reason, { warningCount: newWarnings });
    
    return newWarnings;
  };

  // Clear user warnings
  const clearUserWarnings = (userId) => {
    localStorage.removeItem(`warnings_${userId}`);
    logModerationAction('CLEAR_WARNINGS', userId, 'Warnings cleared');
  };

  // Get moderation presets
  const getModerationPresets = () => {
    return {
      banReasons: [
        'Spam',
        'Harassment',
        'Inappropriate content',
        'Repeated violations',
        'Abusive behavior'
      ],
      muteReasons: [
        'Minor spam',
        'Off-topic messages',
        'Excessive caps',
        'Mild inappropriate language'
      ],
      banDurations: [
        { label: 'Permanent', value: -1 },
        { label: '1 Hour', value: 3600 },
        { label: '24 Hours', value: 86400 },
        { label: '7 Days', value: 604800 },
        { label: '30 Days', value: 2592000 }
      ],
      muteDurations: [
        { label: 'Permanent', value: -1 },
        { label: '5 Minutes', value: 300 },
        { label: '30 Minutes', value: 1800 },
        { label: '1 Hour', value: 3600 },
        { label: '24 Hours', value: 86400 }
      ]
    };
  };

  // Return object with all methods and constants
  return {
    reportCategories,
    containsProfanity,
    filterMessage,
    shouldBlockMessage,
    autoModerateMessage,
    banUserWithReason,
    muteUserWithReason,
    deleteMessageWithReason,
    reportContent,
    getModerationStats,
    logModerationAction,
    getUserWarnings,
    addUserWarning,
    clearUserWarnings,
    getModerationPresets
  };
};

const moderationService = createModerationService();
export default moderationService;