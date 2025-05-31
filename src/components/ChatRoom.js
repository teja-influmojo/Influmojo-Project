// src/components/ChatRoom.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import sendbirdService from '../services/sendbirdService';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import UserList from './UserList';
import PackageList from './PackageList';

const ChatRoom = ({ currentUser, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [channel, setChannel] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const messageHandlerRef = useRef(null);
  const currentChannelRef = useRef(null);
  const isLoadingMessagesRef = useRef(false); // Add flag to prevent race conditions

  // Keep refs in sync
  useEffect(() => {
    currentChannelRef.current = channel;
  }, [channel]);

  // Load users on component mount (only for Bob)
  useEffect(() => {
    if (currentUser.userId === 'user2') { // Bob's user ID
      loadUsers();
    }
  }, [currentUser.userId]);

  // Set up message handlers and presence - FIXED
  useEffect(() => {
    const handlerId = `messageHandler_${Date.now()}_${currentUser.userId}`;
    messageHandlerRef.current = handlerId;
    
    console.log('Setting up message handler:', handlerId);
    
    // Set up message handler
    sendbirdService.addMessageHandler(handlerId, {
      onMessageReceived: (receivedChannel, message) => {
        console.log('=== MESSAGE RECEIVED ===');
        console.log('Message:', message.message);
        console.log('From:', message._sender.userId);
        console.log('Channel URL:', receivedChannel.url);
        console.log('Channel members:', receivedChannel.members.map(m => m.userId));
        
        // Check if this message is for the Alice-Bob conversation
        const channelMembers = receivedChannel.members.map(member => member.userId);
        const isAliceBobConversation = channelMembers.includes('user1') && 
                                     channelMembers.includes('user2');
        
        console.log('Is Alice-Bob conversation:', isAliceBobConversation);
        
        if (!isAliceBobConversation) {
          console.log('Ignoring message - not Alice-Bob conversation');
          return;
        }

        // Update messages state if it's the Alice-Bob conversation
        setMessages(prevMessages => {
          console.log('Updating messages state. Previous count:', prevMessages.length);
          
          // Avoid duplicate messages
          const exists = prevMessages.some(msg => 
            msg.messageId === message.messageId || 
            (msg.reqId && msg.reqId === message.reqId)
          );
          
          if (exists) {
            console.log('Message already exists, not adding duplicate');
            return prevMessages;
          }
          
          const newMessages = [...prevMessages, message];
          console.log('New messages count:', newMessages.length);
          return newMessages;
        });

        // Update unread count if message is not from current user
        if (message._sender.userId !== currentUser.userId) {
          console.log('Message from other user, checking unread count');
          // Only increment unread if the channel is not currently active
          const currentChannel = currentChannelRef.current;
          if (!currentChannel || receivedChannel.url !== currentChannel.url) {
            console.log('Incrementing unread count');
            setUnreadCount(prev => prev + 1);
          } else {
            console.log('Channel is active, not incrementing unread count');
          }
        }
      },
      onUserJoined: (channel, user) => {
        console.log('User joined:', user.userId);
        setOnlineUsers(prev => new Set([...prev, user.userId]));
      },
      onUserLeft: (channel, user) => {
        console.log('User left:', user.userId);
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(user.userId);
          return newSet;
        });
      }
    });

    // Set up presence handler
    const presenceHandler = {
      onUserOnline: (user) => {
        console.log('User online:', user.userId);
        setOnlineUsers(prev => new Set([...prev, user.userId]));
      },
      onUserOffline: (user) => {
        console.log('User offline:', user.userId);
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(user.userId);
          return newSet;
        });
      }
    };

    try {
      sendbirdService.addPresenceHandler(presenceHandler);
    } catch (error) {
      console.error('Failed to add presence handler:', error);
    }

    return () => {
      console.log('Cleaning up message handler:', handlerId);
      if (messageHandlerRef.current) {
        sendbirdService.removeMessageHandler(messageHandlerRef.current);
      }
    };
  }, [currentUser.userId]); 

  const loadUsers = async () => {
    try {
      const applicationUsers = await sendbirdService.getApplicationUsers();
      // For Bob, only show Alice
      const otherUsers = applicationUsers.filter(user => 
        user.userId === 'user1' // Only show Alice
      );
      setUsers(otherUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadMessages = async (targetChannel, preserveLocalMessages = false) => {
    // Prevent multiple simultaneous message loading
    if (isLoadingMessagesRef.current) {
      console.log('Already loading messages, skipping...');
      return;
    }

    isLoadingMessagesRef.current = true;
    
    try {
      console.log('Loading messages for channel:', targetChannel.url);
      
      // Get current local messages if we want to preserve them
      const currentMessages = preserveLocalMessages ? messages : [];
      
      // Load messages from server
      console.log('Loading messages from server');
      const serverMessages = await sendbirdService.getChannelMessages(targetChannel, 50);
      
      // Filter messages to only show between Alice and Bob (additional safety check)
      const filteredMessages = serverMessages.filter(message => {
        const senderId = message._sender.userId;
        return senderId === 'user1' || senderId === 'user2';
      });
      
      console.log('Loaded messages from server:', filteredMessages.length);
      
      // Merge local and server messages, removing duplicates
      let finalMessages = [...filteredMessages];
      
      if (preserveLocalMessages && currentMessages.length > 0) {
        // Add any local messages that aren't in server messages yet
        currentMessages.forEach(localMsg => {
          const existsInServer = filteredMessages.some(serverMsg => 
            serverMsg.messageId === localMsg.messageId || 
            (serverMsg.reqId && localMsg.reqId && serverMsg.reqId === localMsg.reqId)
          );
          
          if (!existsInServer) {
            console.log('Adding local message not yet on server:', localMsg.message);
            finalMessages.push(localMsg);
          }
        });
        
        // Sort by timestamp
        finalMessages.sort((a, b) => a.createdAt - b.createdAt);
      }
      
      setMessages(finalMessages);
      
      // Update cache after loading
      filteredMessages.forEach(message => {
        sendbirdService.addMessageToCache(targetChannel, message);
      });
      
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      isLoadingMessagesRef.current = false;
    }
  };

  const startChat = async (targetUser) => {
    setLoading(true);
    try {
      console.log('Starting chat...');
      
      // Always include both Alice and Bob in the conversation
      const userIds = ['user1', 'user2']; // Fixed user IDs for Alice and Bob
      const channelName = `Alice & Bob Chat`;
      
      console.log('Creating/getting channel for userIds:', userIds);
      
      const newChannel = await sendbirdService.createOrGetChannel(userIds, channelName);
      console.log('Channel obtained:', newChannel.url);
      
      // Check if this is the same channel we already have
      const isSameChannel = channel && channel.url === newChannel.url;
      
      setChannel(newChannel);
      setSelectedUser(targetUser);
      setUnreadCount(0); // Reset unread count when starting chat
      
      // Load messages for the channel
      // If it's the same channel, preserve local messages to avoid losing recent ones
      await loadMessages(newChannel, isSameChannel);
      
      console.log('Chat started successfully');
      console.log('Channel members:', newChannel.members.map(m => m.userId));
      
    } catch (error) {
      console.error('Failed to start chat:', error);
      alert('Failed to start chat. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (messageText) => {
    if (!channel || !messageText.trim()) {
      console.log('Cannot send message - no channel or empty message');
      return;
    }

    try {
      console.log('Sending message:', messageText.trim());
      const message = await sendbirdService.sendMessage(messageText.trim());
      console.log('Message sent successfully:', message);
      
      // Add message to local state immediately for better UX
      setMessages(prevMessages => {
        const exists = prevMessages.some(msg => 
          msg.messageId === message.messageId || 
          (msg.reqId && msg.reqId === message.reqId)
        );
        
        if (exists) {
          return prevMessages;
        }
        
        return [...prevMessages, message];
      });
      
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      console.log('Logging out...');
      if (messageHandlerRef.current) {
        sendbirdService.removeMessageHandler(messageHandlerRef.current);
      }
      await sendbirdService.disconnect();
      onLogout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="chat-room">
      <div className="chat-header">
        <div className="user-info">
          <span>Welcome, {currentUser.nickname}!</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
        {channel && (
          <div className="channel-info">
            <h3>
              {currentUser.userId === 'user1' ? (
                <>Chatting with Bob</>
              ) : (
                <>Chatting with Alice</>
              )}
              {((currentUser.userId === 'user1' && onlineUsers.has('user2')) ||
                (currentUser.userId === 'user2' && onlineUsers.has('user1'))) && (
                <span className="online-indicator">● Online</span>
              )}
              {unreadCount > 0 && (
                <span className="unread-count">({unreadCount} unread)</span>
              )}
            </h3>
          </div>
        )}
      </div>

      <div className="chat-content">
        <div className="users-panel">
          {currentUser.userId === 'user1' ? ( // Alice's user ID
            <PackageList onPurchaseComplete={startChat} />
          ) : (
            <UserList 
              users={users} 
              onUserSelect={startChat}
              loading={loading}
              selectedUser={selectedUser}
              onlineUsers={onlineUsers}
              unreadCounts={unreadCount}
            />
          )}
        </div>

        <div className="messages-panel">
          {channel ? (
            <>
              <MessageList 
                messages={messages} 
                currentUser={currentUser}
              />
              <MessageInput 
                onSendMessage={sendMessage}
                disabled={loading}
              />
            </>
          ) : (
            <div className="no-chat">
              {currentUser.userId === 'user1' ? (
                <p>Purchase a package to start chatting with Bob!</p>
              ) : (
                <p>Select Alice from the left panel to start chatting!</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;    