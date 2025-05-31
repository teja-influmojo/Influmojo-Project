// src/services/sendbirdService.js
import SendBird from 'sendbird';

// Create the SendBird service using functional approach
const createSendBirdService = () => {
  // Private state (closure variables)
  let sb = null;
  let currentUser = null;
  let currentChannel = null;
  let channelCache = new Map();
  let messageHandlers = [];
  let presenceHandlers = [];
  let eventCallbacks = new Map(); // Store callbacks for live updates

  // Initialize SendBird instance
  const initializeSendBird = () => {
    if (!sb) {
      sb = new SendBird({ appId: '4B262989-8C6E-4A7E-A097-674C612687C4' });
    }
    return sb;
  };

  // Connection functions
  const connect = async (userId, nickname) => {
    const sendbird = initializeSendBird();
    
    return new Promise((resolve, reject) => {
      sendbird.connect(userId, (user, error) => {
        if (error) {
          reject(error);
          return;
        }
        
        // Update user profile (optional)
        sendbird.updateCurrentUserInfo(nickname, null, (response, error) => {
          if (error) {
            console.warn('Failed to update user info:', error);
          }
        });
        
        currentUser = user;
        
        // Set up global message handler for live updates
        setupGlobalMessageHandler();
        
        resolve(user);
      });
    });
  };

  const disconnect = async () => {
    if (!sb) return;
    
    return new Promise((resolve) => {
      // Clean up all handlers before disconnecting
      removeAllMessageHandlers();
      removeAllPresenceHandlers();
      
      sb.disconnect(() => {
        currentUser = null;
        currentChannel = null;
        channelCache.clear();
        eventCallbacks.clear();
        resolve();
      });
    });
  };

  // Set up global message handler for live updates
  const setupGlobalMessageHandler = () => {
    const sendbird = initializeSendBird();
    const globalHandlerId = 'global_message_handler';
    
    // Remove existing global handler if it exists
    sendbird.removeChannelHandler(globalHandlerId);
    
    const channelHandler = new sendbird.ChannelHandler();
    
    channelHandler.onMessageReceived = (channel, message) => {
      console.log('Global handler: Message received', message.message);
      
      // Always add to cache first
      addMessageToCache(channel, message);
      
      // Notify all registered callbacks
      eventCallbacks.forEach((callback, callbackId) => {
        if (callback.onMessageReceived) {
          try {
            callback.onMessageReceived(channel, message);
          } catch (error) {
            console.error('Error in message callback:', error);
          }
        }
      });
    };

    channelHandler.onUserJoined = (channel, user) => {
      eventCallbacks.forEach((callback) => {
        if (callback.onUserJoined) {
          callback.onUserJoined(channel, user);
        }
      });
    };

    channelHandler.onUserLeft = (channel, user) => {
      eventCallbacks.forEach((callback) => {
        if (callback.onUserLeft) {
          callback.onUserLeft(channel, user);
        }
      });
    };

    sendbird.addChannelHandler(globalHandlerId, channelHandler);
    messageHandlers.push(globalHandlerId);
  };

  // Channel utility functions
  const generateChannelKey = (userIds) => [...userIds].sort().join('-');
  
  const getChannelKey = (channel) => {
    if (!channel?.members) return null;
    const userIds = channel.members.map(member => member.userId).sort();
    return userIds.join('-');
  };

  const getChannelDisplayName = (channel) => {
    if (channel.name) return channel.name;
    
    const memberNames = channel.members
      .filter(member => member.userId !== 'admin')
      .map(member => member.nickname || member.userId)
      .join(' & ');
    
    return memberNames || 'Unknown Channel';
  };

  // Channel management functions
  const findExistingChannel = async (userIds) => {
    const sendbird = initializeSendBird();
    const query = sendbird.GroupChannel.createMyGroupChannelListQuery();
    query.includeEmpty = true;
    query.limit = 100;

    return new Promise((resolve, reject) => {
      query.next((channels, error) => {
        if (error) {
          reject(error);
          return;
        }

        const existingChannel = channels.find(channel => {
          const channelUserIds = channel.members.map(member => member.userId);
          return userIds.every(id => channelUserIds.includes(id)) &&
                 channelUserIds.length === userIds.length;
        });

        resolve(existingChannel || null);
      });
    });
  };

  const createNewChannel = async (userIds, channelName) => {
    const sendbird = initializeSendBird();
    const params = new sendbird.GroupChannelParams();
    params.addUserIds(userIds);
    params.name = channelName;
    params.isDistinct = true;

    return new Promise((resolve, reject) => {
      sendbird.GroupChannel.createChannel(params, (channel, error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(channel);
      });
    });
  };

  const createOrGetChannel = async (userIds, channelName) => {
    const channelKey = generateChannelKey(userIds);
    
    // Check cache first
    if (channelCache.has(channelKey)) {
      const cachedChannel = channelCache.get(channelKey);
      currentChannel = cachedChannel.channel;
      return cachedChannel.channel;
    }

    try {
      // Try to find existing channel
      let channel = await findExistingChannel(userIds);
      
      // Create new channel if none exists
      if (!channel) {
        channel = await createNewChannel(userIds, channelName);
      }

      // Cache the channel
      channelCache.set(channelKey, {
        channel,
        messages: []
      });

      currentChannel = channel;
      return channel;
    } catch (error) {
      throw error;
    }
  };

  const getChannel = async (channelUrl) => {
    const sendbird = initializeSendBird();
    
    return new Promise((resolve, reject) => {
      sendbird.GroupChannel.getChannel(channelUrl, (channel, error) => {
        if (error) {
          reject(error);
          return;
        }
        currentChannel = channel;
        resolve(channel);
      });
    });
  };

  // Message functions
  const sendMessage = async (message) => {
    if (!currentChannel) {
      throw new Error('No active channel');
    }

    const sendbird = initializeSendBird();
    const params = new sendbird.UserMessageParams();
    params.message = message;

    return new Promise((resolve, reject) => {
      currentChannel.sendUserMessage(params, (sentMessage, error) => {
        if (error) {
          reject(error);
          return;
        }
        
        // Update cache immediately
        addMessageToCache(currentChannel, sentMessage);
        resolve(sentMessage);
      });
    });
  };

  const getPreviousMessages = async (limit = 50) => {
    if (!currentChannel) {
      throw new Error('No active channel');
    }

    const channelKey = getChannelKey(currentChannel);
    
    // Return cached messages if available
    if (channelCache.has(channelKey)) {
      const cached = channelCache.get(channelKey);
      if (cached.messages.length > 0) {
        return cached.messages;
      }
    }

    return new Promise((resolve, reject) => {
      const messageListQuery = currentChannel.createPreviousMessageListQuery();
      messageListQuery.limit = limit;
      messageListQuery.reverse = false;

      messageListQuery.load((messages, error) => {
        if (error) {
          reject(error);
          return;
        }
        
        const reversedMessages = messages.reverse();
        
        // Update cache
        if (channelCache.has(channelKey)) {
          const cached = channelCache.get(channelKey);
          cached.messages = reversedMessages;
        }
        
        resolve(reversedMessages);
      });
    });
  };

  const getChannelMessages = async (channel, limit = 50) => {
    return new Promise((resolve, reject) => {
      const messageListQuery = channel.createPreviousMessageListQuery();
      messageListQuery.limit = limit;
      messageListQuery.reverse = false;

      messageListQuery.load((messages, error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(messages.reverse());
      });
    });
  };

  // Cache management
  const addMessageToCache = (channel, message) => {
    const channelKey = getChannelKey(channel);
    if (!channelKey) return;

    // Ensure channel is in cache
    if (!channelCache.has(channelKey)) {
      channelCache.set(channelKey, {
        channel,
        messages: []
      });
    }

    const cached = channelCache.get(channelKey);
    const messageExists = cached.messages.some(msg => 
      msg.messageId === message.messageId || 
      (msg.reqId && msg.reqId === message.reqId)
    );

    if (!messageExists) {
      cached.messages.push(message);
      console.log('Message added to cache:', message.message);
    }
  };

  const getCachedMessages = (channel) => {
    const channelKey = getChannelKey(channel);
    return channelCache.has(channelKey) 
      ? channelCache.get(channelKey).messages 
      : [];
  };

  // User management
  const getApplicationUsers = async () => {
    const sendbird = initializeSendBird();
    const userListQuery = sendbird.createApplicationUserListQuery();
    userListQuery.limit = 100;
    
    return new Promise((resolve, reject) => {
      userListQuery.next((users, error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(users);
      });
    });
  };

  // Admin functions
  const getMyChannels = async () => {
    const sendbird = initializeSendBird();
    const query = sendbird.GroupChannel.createMyGroupChannelListQuery();
    query.includeEmpty = true;
    query.limit = 100;
    query.order = 'latest_last_message';

    return new Promise((resolve, reject) => {
      query.next((channels, error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(channels);
      });
    });
  };

  const searchPublicChannelsByUsers = async (userIds) => {
    const sendbird = initializeSendBird();
    const query = sendbird.GroupChannel.createPublicGroupChannelListQuery();
    query.limit = 100;
    
    return new Promise((resolve, reject) => {
      query.next((channels, error) => {
        if (error) {
          reject(error);
          return;
        }

        const channel = channels.find(channel => {
          const channelUserIds = channel.members.map(member => member.userId);
          return userIds.every(id => channelUserIds.includes(id));
        });

        resolve(channel || null);
      });
    });
  };

  const findChannelByUsers = async (userIds) => {
    try {
      // Try user's channels first
      const channel = await findExistingChannel(userIds);
      if (channel) return channel;

      // Fallback to public channels
      return await searchPublicChannelsByUsers(userIds);
    } catch (error) {
      return null;
    }
  };

  // Event handlers - Updated approach
  const addMessageHandler = (handlerId, handler) => {
    // Store the callback for the global handler to use
    eventCallbacks.set(handlerId, handler);
    console.log('Message handler added:', handlerId);
  };

  const addPresenceHandler = (handler) => {
    const sendbird = initializeSendBird();
    const presenceHandler = new sendbird.UserEventHandler();
    
    presenceHandler.onUserOnline = (user) => {
      handler.onUserOnline?.(user);
    };

    presenceHandler.onUserOffline = (user) => {
      handler.onUserOffline?.(user);
    };

    const handlerId = `presence_${Date.now()}`;
    sendbird.addUserEventHandler(handlerId, presenceHandler);
    presenceHandlers.push(handlerId);
  };

  const removeMessageHandler = (handlerId) => {
    // Remove from event callbacks
    eventCallbacks.delete(handlerId);
    console.log('Message handler removed:', handlerId);
  };

  const removeAllMessageHandlers = () => {
    const sendbird = initializeSendBird();
    messageHandlers.forEach(handlerId => {
      sendbird.removeChannelHandler(handlerId);
    });
    messageHandlers.length = 0;
    eventCallbacks.clear();
  };

  const removeAllPresenceHandlers = () => {
    const sendbird = initializeSendBird();
    presenceHandlers.forEach(handlerId => {
      sendbird.removeUserEventHandler(handlerId);
    });
    presenceHandlers.length = 0;
  };

  // Missing admin functions that are referenced but not defined
  const getAllChannelsForAdmin = async () => {
    return await getMyChannels();
  };

  const sendAdminMessage = async (channelUrl, message) => {
    try {
      const channel = await getChannel(channelUrl);
      const currentChannelBackup = currentChannel;
      currentChannel = channel;
      const result = await sendMessage(message);
      currentChannel = currentChannelBackup;
      return result;
    } catch (error) {
      throw error;
    }
  };

  const sendJoinRequest = async (channelUrl) => {
    try {
      const sendbird = initializeSendBird();
      const channel = await getChannel(channelUrl);
      
      return new Promise((resolve, reject) => {
        channel.join((response, error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(response);
        });
      });
    } catch (error) {
      throw error;
    }
  };

  // Getters
  const getCurrentUser = () => currentUser;
  const getCurrentChannel = () => currentChannel;
  const getAllChannels = () => getAllChannelsForAdmin(); // Legacy support

  // Return public API
  return {
    // Connection
    connect,
    disconnect,
    
    // Channels
    createOrGetChannel,
    getChannel,
    getAllChannelsForAdmin,
    getAllChannels,
    getMyChannels,
    
    // Messages
    sendMessage,
    getPreviousMessages,
    getChannelMessages,
    getCachedMessages,
    
    // Admin functions
    sendAdminMessage,
    sendJoinRequest,
    
    // Users
    getApplicationUsers,
    
    // Event handlers
    addMessageHandler,
    addPresenceHandler,
    removeMessageHandler,
    removeAllMessageHandlers,
    
    // Getters
    getCurrentUser,
    getCurrentChannel,
    getChannelDisplayName,
    
    // Utilities
    findChannelByUsers,
    addMessageToCache
  };
};

// Create and export a singleton instance
export default createSendBirdService();