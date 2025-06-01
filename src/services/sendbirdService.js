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
          console.error('Failed to send message:', error.message);
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

  // File upload functions
  const uploadFile = async (file, customType = null, data = null) => {
    if (!currentChannel) {
      throw new Error('No active channel');
    }

    const sendbird = initializeSendBird();
    const params = new sendbird.FileMessageParams();
    
    // Set file parameters
    params.file = file;
    params.fileName = file.name;
    params.fileSize = file.size;
    params.mimeType = file.type;
    params.customType = customType;
    params.data = data;
    params.thumbnailSizes = [
      { maxWidth: 320, maxHeight: 320 },
      { maxWidth: 640, maxHeight: 640 }
    ];

    return new Promise((resolve, reject) => {
      currentChannel.sendFileMessage(params, (message, error) => {
        if (error) {
          console.error('Failed to upload file:', error);
          reject(error);
          return;
        }
        
        console.log('File uploaded successfully:', message.name);
        addMessageToCache(currentChannel, message);
        resolve(message);
      });
    });
  };

  const uploadImage = async (imageFile, customType = null, data = null) => {
    if (!currentChannel) {
      throw new Error('No active channel');
    }

    const sendbird = initializeSendBird();
    const params = new sendbird.FileMessageParams();
    
    // Set image parameters
    params.file = imageFile;
    params.fileName = imageFile.name;
    params.fileSize = imageFile.size;
    params.mimeType = imageFile.type;
    params.customType = customType || 'image';
    params.data = data;
    
    // Add image-specific parameters
    params.thumbnailSizes = [
      { maxWidth: 320, maxHeight: 320 },
      { maxWidth: 640, maxHeight: 640 }
    ];
    params.requireAuth = false;
    params.thumbnailIndex = 0;

    return new Promise((resolve, reject) => {
      currentChannel.sendFileMessage(params, (message, error) => {
        if (error) {
          console.error('Failed to upload image:', error);
          reject(error);
          return;
        }
        
        console.log('Image uploaded successfully:', message.name);
        addMessageToCache(currentChannel, message);
        resolve(message);
      });
    });
  };

  const uploadVideo = async (videoFile, customType = null, data = null) => {
    if (!currentChannel) {
      throw new Error('No active channel');
    }

    const sendbird = initializeSendBird();
    const params = new sendbird.FileMessageParams();
    
    // Set video parameters
    params.file = videoFile;
    params.fileName = videoFile.name;
    params.fileSize = videoFile.size;
    params.mimeType = videoFile.type;
    params.customType = customType || 'video';
    params.data = data;
    
    // Add video-specific parameters
    params.thumbnailSizes = [
      { maxWidth: 320, maxHeight: 320 }
    ];
    params.requireAuth = false;

    return new Promise((resolve, reject) => {
      currentChannel.sendFileMessage(params, (message, error) => {
        if (error) {
          console.error('Failed to upload video:', error);
          reject(error);
          return;
        }
        
        console.log('Video uploaded successfully:', message.name);
        addMessageToCache(currentChannel, message);
        resolve(message);
      });
    });
  };

  const uploadAudio = async (audioFile, customType = null, data = null) => {
    if (!currentChannel) {
      throw new Error('No active channel');
    }

    const sendbird = initializeSendBird();
    const params = new sendbird.FileMessageParams();
    
    // Set audio parameters
    params.file = audioFile;
    params.fileName = audioFile.name;
    params.fileSize = audioFile.size;
    params.mimeType = audioFile.type;
    params.customType = customType || 'audio';
    params.data = data;
    params.requireAuth = false;

    return new Promise((resolve, reject) => {
      currentChannel.sendFileMessage(params, (message, error) => {
        if (error) {
          console.error('Failed to upload audio:', error);
          reject(error);
          return;
        }
        
        console.log('Audio uploaded successfully:', message.name);
        addMessageToCache(currentChannel, message);
        resolve(message);
      });
    });
  };

  const uploadDocument = async (documentFile, customType = null, data = null) => {
    if (!currentChannel) {
      throw new Error('No active channel');
    }

    const sendbird = initializeSendBird();
    const params = new sendbird.FileMessageParams();
    
    // Set document parameters
    params.file = documentFile;
    params.fileName = documentFile.name;
    params.fileSize = documentFile.size;
    params.mimeType = documentFile.type;
    params.customType = customType || 'document';
    params.data = data;
    params.requireAuth = false;

    return new Promise((resolve, reject) => {
      currentChannel.sendFileMessage(params, (message, error) => {
        if (error) {
          console.error('Failed to upload document:', error);
          reject(error);
          return;
        }
        
        console.log('Document uploaded successfully:', message.name);
        addMessageToCache(currentChannel, message);
        resolve(message);
      });
    });
  };

  // File download functions
  const downloadFile = async (message) => {
    if (!message || !message.url) {
      throw new Error('Invalid message or file URL');
    }

    const sendbird = initializeSendBird();
    
    return new Promise((resolve, reject) => {
      sendbird.downloadFile(message.url, (response, error) => {
        if (error) {
          console.error('Failed to download file:', error);
          reject(error);
          return;
        }
        
        // Create a blob from the response
        const blob = new Blob([response], { type: message.type });
        const url = URL.createObjectURL(blob);
        
        resolve({
          url,
          blob,
          name: message.name,
          type: message.type
        });
      });
    });
  };

  // File preview functions
  const getFilePreview = async (message) => {
    if (!message || !message.url) {
      throw new Error('Invalid message or file URL');
    }

    const sendbird = initializeSendBird();
    
    return new Promise((resolve, reject) => {
      sendbird.getFilePreview(message.url, (response, error) => {
        if (error) {
          console.error('Failed to get file preview:', error);
          reject(error);
          return;
        }
        
        // Create a blob from the response
        const blob = new Blob([response], { type: message.type });
        const url = URL.createObjectURL(blob);
        
        resolve({
          url,
          blob,
          name: message.name,
          type: message.type
        });
      });
    });
  };

  const sendFileMessage = async (file, fileType = 'file', progressCallback = null) => {
    return new Promise((resolve, reject) => {
      if (!currentChannel) {
        reject(new Error('No active channel'));
        return;
      }
  
      console.log('Sending file message:', file.name);
  
      const params = sb.BaseMessageCreateParams();
      params.file = file;
      params.fileName = file.name;
      params.fileSize = file.size;
      params.mimeType = file.type;
  
      // Set custom type based on file type
      params.customType = fileType;
      
      // Add metadata
      params.data = JSON.stringify({
        fileType: fileType,
        originalName: file.name,
        fileSize: formatFileSize(file.size),
        uploadTime: new Date().toISOString()
      });

      // Add thumbnails for images and videos
      if (fileType === 'image' || fileType === 'video') {
        params.thumbnails = [
          { url: '', width: 240, height: 240 },  // Small thumbnail
          { url: '', width: 480, height: 480 },  // Medium thumbnail
          { url: '', width: 720, height: 720 }   // Large thumbnail
        ];
      }

      // Set require_auth to true for secure file access
      params.requireAuth = true;

      // Add push notification settings
      params.sendPush = true;
      params.pushMessageTemplate = {
        title: 'New file shared',
        body: `${currentUser.nickname} shared a ${fileType}`
      };
  
      currentChannel.sendFileMessage(params)
        .onPending((message) => {
          console.log('File message pending:', message);
          if (progressCallback) {
            progressCallback('pending', 0);
          }
        })
        .onFailed((error) => {
          console.error('File message failed:', error);
          if (progressCallback) {
            progressCallback('failed', 0);
          }
          reject(error);
        })
        .onSucceeded((message) => {
          console.log('File message succeeded:', message);
          addMessageToCache(currentChannel, message);
          if (progressCallback) {
            progressCallback('succeeded', 100);
          }
          resolve(message);
        })
        .onUploaded((message) => {
          console.log('File uploaded:', message);
          if (progressCallback) {
            progressCallback('uploaded', 100);
          }
        })
        .onProgress((progress) => {
          console.log('Upload progress:', progress);
          if (progressCallback) {
            progressCallback('uploading', progress);
          }
        });
    });
  };

  // Send multiple files in a single message
  const sendMultipleFiles = async (files, progressCallback = null) => {
    return new Promise((resolve, reject) => {
      if (!currentChannel) {
        reject(new Error('No active channel'));
        return;
      }

      const filePromises = files.map(file => {
        const fileType = getFileTypeFromMime(file.type);
        return sendFileMessage(file, fileType, progressCallback);
      });

      Promise.all(filePromises)
        .then(messages => {
          console.log('All files uploaded successfully:', messages);
          resolve(messages);
        })
        .catch(error => {
          console.error('Error uploading files:', error);
          reject(error);
        });
    });
  };

  // Send file from URL
  const sendFileFromUrl = async (fileUrl, fileName, fileType, fileSize) => {
    return new Promise((resolve, reject) => {
      if (!currentChannel) {
        reject(new Error('No active channel'));
        return;
      }

      const params = sb.BaseMessageCreateParams();
      params.url = fileUrl;
      params.fileName = fileName;
      params.fileSize = fileSize;
      params.customType = fileType;
      params.requireAuth = true;

      currentChannel.sendFileMessage(params)
        .onSucceeded((message) => {
          console.log('File from URL sent successfully:', message);
          addMessageToCache(currentChannel, message);
          resolve(message);
        })
        .onFailed((error) => {
          console.error('Failed to send file from URL:', error);
          reject(error);
        });
    });
  };

  // Helper function to determine file type from MIME type
  const getFileTypeFromMime = (mimeType) => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf') || 
        mimeType.includes('document') || 
        mimeType.includes('text/') ||
        mimeType.includes('application/')) return 'document';
    return 'file';
  };
  
  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Moderation functions
  const canModerate = (channel) => {
    if (!channel || !currentUser) return false;
    
    // Check if user is an operator
    const isOperator = channel.operators && Array.isArray(channel.operators) && 
      channel.operators.some(op => op.userId === currentUser.userId);
    
    // Check if user is the channel creator
    const isCreator = channel.createdBy === currentUser.userId;
    
    return isOperator || isCreator;
  };

  const isCurrentUserOperator = (channel) => {
    if (!channel || !currentUser) return false;
    return channel.operators && Array.isArray(channel.operators) && 
      channel.operators.some(op => op.userId === currentUser.userId);
  };

  const reportMessage = async (message, category, description) => {
    const sendbird = initializeSendBird();
    return new Promise((resolve, reject) => {
      sendbird.reportMessage(message, category, description, (response, error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  };

  const reportUser = async (userId, category, description) => {
    const sendbird = initializeSendBird();
    return new Promise((resolve, reject) => {
      sendbird.reportUser(userId, category, description, (response, error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  };

  const reportChannel = async (channel, category, description) => {
    const sendbird = initializeSendBird();
    return new Promise((resolve, reject) => {
      sendbird.reportChannel(channel.url, category, description, (response, error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  };

  const deleteMessage = async (message) => {
    const sendbird = initializeSendBird();
    return new Promise((resolve, reject) => {
      sendbird.deleteMessage(message, (response, error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  };

  const banUser = async (channel, userId, reason, duration = -1) => {
    const sendbird = initializeSendBird();
    return new Promise((resolve, reject) => {
      sendbird.banUser(userId, reason, duration, (response, error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  };

  const unbanUser = async (channel, userId) => {
    const sendbird = initializeSendBird();
    return new Promise((resolve, reject) => {
      sendbird.unbanUser(userId, (response, error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  };

  const muteUser = async (channel, userId, reason, duration = -1) => {
    const sendbird = initializeSendBird();
    return new Promise((resolve, reject) => {
      sendbird.muteUser(userId, reason, duration, (response, error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  };

  const unmuteUser = async (channel, userId) => {
    const sendbird = initializeSendBird();
    return new Promise((resolve, reject) => {
      sendbird.unmuteUser(userId, (response, error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  };

  const getBannedUsers = async (channel) => {
    const sendbird = initializeSendBird();
    return new Promise((resolve, reject) => {
      const query = sendbird.createBannedUserListQuery(channel.url);
      query.next((bannedUsers, error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(bannedUsers);
      });
    });
  };

  const getMutedUsers = async (channel) => {
    const sendbird = initializeSendBird();
    return new Promise((resolve, reject) => {
      const query = sendbird.createMutedUserListQuery(channel.url);
      query.next((mutedUsers, error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(mutedUsers);
      });
    });
  };

  // Return public API
  return {
    // Connection
    connect,
    disconnect,
    sendFileMessage,
    getFileTypeFromMime,
    formatFileSize,
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
    clearChannelCache,
    
    // File upload methods
    uploadFile,
    uploadImage,
    uploadVideo,
    uploadAudio,
    uploadDocument,
    
    // File download methods
    downloadFile,
    getFilePreview,
    
    // Moderation functions
    canModerate,
    isCurrentUserOperator,
    reportMessage,
    reportUser,
    reportChannel,
    deleteMessage,
    banUser,
    unbanUser,
    muteUser,
    unmuteUser,
    getBannedUsers,
    getMutedUsers,
  };
};

// Create and export a singleton instance
export default createSendBirdService();