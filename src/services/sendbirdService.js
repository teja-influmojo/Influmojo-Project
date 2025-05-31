// src/services/sendbirdService.js
import SendBird from 'sendbird';

// Create the SendBird service using functional approach
const createSendBirdService = () => {
  // Private state (closure variables)
  let sb = null;
  let currentUser = null;
  let currentChannel = null;
  let channelCache = new Map();
  let messageHandlers = new Map(); // Changed to Map for better tracking
  let presenceHandlers = [];
  let globalHandlerSetup = false;

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
        messageHandlers.clear();
        globalHandlerSetup = false;
        resolve();
      });
    });
  };

  // Set up global message handler for live updates - FIXED
  const setupGlobalMessageHandler = () => {
    if (globalHandlerSetup) {
      console.log('Global handler already setup, skipping');
      return;
    }

    const sendbird = initializeSendBird();
    const globalHandlerId = `global_handler_${currentUser.userId}`;
    
    // Remove existing global handler if it exists
    sendbird.removeChannelHandler(globalHandlerId);
    
    const channelHandler = new sendbird.ChannelHandler();
    
    channelHandler.onMessageReceived = (channel, message) => {
      console.log('=== GLOBAL HANDLER: Message received ===');
      console.log('Message:', message.message);
      console.log('From:', message._sender.userId);
      console.log('Channel URL:', channel.url);
      console.log('Current user:', currentUser?.userId);
      
      // Always add to cache first - this ensures persistence
      addMessageToCache(channel, message);
      
      // Notify all registered message handlers
      messageHandlers.forEach((handler, handlerId) => {
        console.log('Notifying handler:', handlerId);
        if (handler.onMessageReceived) {
          try {
            handler.onMessageReceived(channel, message);
          } catch (error) {
            console.error('Error in message callback:', error);
          }
        }
      });
    };

    channelHandler.onUserJoined = (channel, user) => {
      console.log('Global handler: User joined', user.userId);
      messageHandlers.forEach((handler) => {
        if (handler.onUserJoined) {
          handler.onUserJoined(channel, user);
        }
      });
    };

    channelHandler.onUserLeft = (channel, user) => {
      console.log('Global handler: User left', user.userId);
      messageHandlers.forEach((handler) => {
        if (handler.onUserLeft) {
          handler.onUserLeft(channel, user);
        }
      });
    };

    sendbird.addChannelHandler(globalHandlerId, channelHandler);
    globalHandlerSetup = true;
    console.log('Global message handler setup completed:', globalHandlerId);
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
    params.isDistinct = true; // This ensures only one channel between same users

    return new Promise((resolve, reject) => {
      sendbird.GroupChannel.createChannel(params, (channel, error) => {
        if (error) {
          reject(error);
          return;
        }
        console.log('New channel created:', channel.url);
        resolve(channel);
      });
    });
  };

  const createOrGetChannel = async (userIds, channelName) => {
    const channelKey = generateChannelKey(userIds);
    console.log('Getting/creating channel for key:', channelKey);
    
    try {
      // Always try to find existing channel first (don't rely on cache for channel creation)
      let channel = await findExistingChannel(userIds);
      
      // Create new channel if none exists
      if (!channel) {
        console.log('No existing channel found, creating new one');
        channel = await createNewChannel(userIds, channelName);
      } else {
        console.log('Found existing channel:', channel.url);
      }

      // Initialize cache entry if it doesn't exist
      if (!channelCache.has(channelKey)) {
        console.log('Initializing cache for channel:', channelKey);
        channelCache.set(channelKey, {
          channel,
          messages: []
        });
      } else {
        // Update the channel reference in cache
        const cached = channelCache.get(channelKey);
        cached.channel = channel;
      }

      currentChannel = channel;
      console.log('Channel ready:', channel.url);
      return channel;
    } catch (error) {
      console.error('Error in createOrGetChannel:', error);
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

  // Message functions - FIXED
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
          console.error('Failed to send message:', error);
          reject(error);
          return;
        }
        
        console.log('Message sent successfully:', sentMessage.message);
        
        // Add to cache immediately for better consistency
        addMessageToCache(currentChannel, sentMessage);
        
        resolve(sentMessage);
      });
    });
  };

  // IMPROVED: Better message loading with delay option for real-time sync
  const getChannelMessages = async (channel, limit = 50, forceRefresh = false, delayMs = 0) => {
    const channelKey = getChannelKey(channel);
    
    // Add small delay if requested (useful after sending messages)
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    // If not forcing refresh, check cache first
    if (!forceRefresh && channelCache.has(channelKey)) {
      const cached = channelCache.get(channelKey);
      if (cached.messages.length > 0) {
        console.log('Returning cached messages:', cached.messages.length);
        return cached.messages;
      }
    }

    console.log('Loading messages from server for channel:', channel.url);
    
    return new Promise((resolve, reject) => {
      const messageListQuery = channel.createPreviousMessageListQuery();
      messageListQuery.limit = limit;
      messageListQuery.reverse = false;

      messageListQuery.load((messages, error) => {
        if (error) {
          console.error('Failed to load messages:', error);
          reject(error);
          return;
        }

        const reversedMessages = messages.reverse();
        console.log('Loaded messages from server:', reversedMessages.length);
        
        // Update cache with fresh messages
        if (!channelCache.has(channelKey)) {
          channelCache.set(channelKey, {
            channel,
            messages: reversedMessages
          });
        } else {
          const cached = channelCache.get(channelKey);
          cached.messages = reversedMessages;
        }
        
        resolve(reversedMessages);
      });
    });
  };

  const getPreviousMessages = async (limit = 50) => {
    if (!currentChannel) {
      throw new Error('No active channel');
    }

    return getChannelMessages(currentChannel, limit, true); // Always force refresh
  };

  // Cache management - IMPROVED
  const addMessageToCache = (channel, message) => {
    const channelKey = getChannelKey(channel);
    if (!channelKey) {
      console.warn('Cannot add message to cache: invalid channel key');
      return;
    }

    console.log('Adding message to cache for channel:', channelKey);

    // Ensure channel is in cache
    if (!channelCache.has(channelKey)) {
      channelCache.set(channelKey, {
        channel,
        messages: []
      });
    }

    const cached = channelCache.get(channelKey);
    
    // Check for duplicate messages more thoroughly
    const messageExists = cached.messages.some(msg => {
      // Check by message ID first
      if (msg.messageId && message.messageId && msg.messageId === message.messageId) {
        return true;
      }
      
      // Check by request ID if message ID not available
      if (msg.reqId && message.reqId && msg.reqId === message.reqId) {
        return true;
      }
      
      // Check by timestamp and content as fallback
      if (msg.createdAt === message.createdAt && 
          msg.message === message.message && 
          msg._sender.userId === message._sender.userId) {
        return true;
      }
      
      return false;
    });

    if (!messageExists) {
      cached.messages.push(message);
      console.log('Message added to cache. Total messages:', cached.messages.length);
    } else {
      console.log('Message already exists in cache, skipping');
    }
  };

  const getCachedMessages = (channel) => {
    const channelKey = getChannelKey(channel);
    return channelCache.has(channelKey) 
      ? channelCache.get(channelKey).messages 
      : [];
  };

  // Clear cache for a channel - useful for debugging
  const clearChannelCache = (channel) => {
    const channelKey = getChannelKey(channel);
    if (channelCache.has(channelKey)) {
      channelCache.delete(channelKey);
      console.log('Cache cleared for channel:', channelKey);
    }
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

  // Event handlers - IMPROVED
  const addMessageHandler = (handlerId, handler) => {
    console.log('Adding message handler:', handlerId);
    messageHandlers.set(handlerId, handler);
    
    // Ensure global handler is setup
    if (!globalHandlerSetup && currentUser) {
      setupGlobalMessageHandler();
    }
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
    console.log('Removing message handler:', handlerId);
    messageHandlers.delete(handlerId);
  };

  const removeAllMessageHandlers = () => {
    const sendbird = initializeSendBird();
    
    // Remove global handler
    if (currentUser) {
      const globalHandlerId = `global_handler_${currentUser.userId}`;
      sendbird.removeChannelHandler(globalHandlerId);
    }
    
    messageHandlers.clear();
    globalHandlerSetup = false;
    console.log('All message handlers removed');
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
    addMessageToCache,
    clearChannelCache // Added for debugging
  };
};

// Create and export a singleton instance
export default createSendBirdService();