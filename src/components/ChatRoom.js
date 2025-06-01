// src/components/ChatRoom.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import sendbirdService from '../services/sendbirdService';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import UserList from './UserList';
import PackageList from './PackageList';
import ModerationPanel from './ModerationPanel';
import ErrorDialog from './ErrorDialog';

const ChatRoom = ({ currentUser, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [channel, setChannel] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showModerationPanel, setShowModerationPanel] = useState(false);
  const messageHandlerRef = useRef(null);
  const currentChannelRef = useRef(null);
  const isLoadingMessagesRef = useRef(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorDialogMessage, setErrorDialogMessage] = useState('');
  const [confirmedDate, setConfirmedDate] = useState(null);
  const [profanityErrorCount, setProfanityErrorCount] = useState(0);
  const [isChatBlocked, setIsChatBlocked] = useState(false);

  // Keep refs in sync
  useEffect(() => {
    currentChannelRef.current = channel;
  }, [channel]);

  // Load users on component mount
  useEffect(() => {
    // Load users for all roles
    loadUsers();
  }, [currentUser.userId]);

  // Set up message handlers and presence
  useEffect(() => {
    const handlerId = `messageHandler_${Date.now()}_${currentUser.userId}`;
    messageHandlerRef.current = handlerId;
    
    console.log('Setting up message handler:', handlerId);
    
    // Set up message handler
    sendbirdService.addMessageHandler(handlerId, {
      onMessageReceived: (receivedChannel, message) => {
        console.log('=== MESSAGE RECEIVED ===');
        console.log('Message type:', message.messageType);
        console.log('From:', message._sender.userId);
        console.log('Channel URL:', receivedChannel.url);
        
        // Check if this message is for the current active channel
        const currentChannel = currentChannelRef.current;
        if (!currentChannel || receivedChannel.url !== currentChannel.url) {
           console.log('Ignoring message - not for current active channel');
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
          const currentChannel = currentChannelRef.current;
          if (!currentChannel || receivedChannel.url !== currentChannel.url) {
            setUnreadCount(prev => prev + 1);
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

      let filteredUsers = [];

      if (currentUser.userId === 'user1') { // Alice (Brand)
        // Alice sees Bob (Influencer), Charlie (Agent), and David (Agent)
        filteredUsers = applicationUsers.filter(user => 
          ['user2', 'user3', 'user4'].includes(user.userId)
        );
      } else if (currentUser.userId === 'user2') { // Bob (Influencer)
        // Bob sees only Alice (Brand)
        filteredUsers = applicationUsers.filter(user => 
          user.userId === 'user1'
        );
      } else if (['user3', 'user4'].includes(currentUser.userId)) { // Charlie or David (Support Agents)
        // Agents see all users except themselves
        filteredUsers = applicationUsers.filter(user => 
          user.userId !== currentUser.userId
        );
      }
      // Add other roles here if needed

      setUsers(filteredUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadMessages = async (targetChannel, preserveLocalMessages = false) => {
    if (isLoadingMessagesRef.current) {
      console.log('Already loading messages, skipping...');
      return;
    }

    isLoadingMessagesRef.current = true;
    
    try {
      console.log('Loading messages for channel:', targetChannel.url);
      
      const currentMessages = preserveLocalMessages ? messages : [];
      
      console.log('Loading messages from server');
      const serverMessages = await sendbirdService.getChannelMessages(targetChannel, 50);
      
      // Filter messages to only show between Alice and Bob
      const filteredMessages = serverMessages.filter(message => {
        const senderId = message._sender.userId;
        return senderId === 'user1' || senderId === 'user2';
      });
      
      console.log('Loaded messages from server:', filteredMessages.length);
      
      let finalMessages = [...filteredMessages];
      
      if (preserveLocalMessages && currentMessages.length > 0) {
        currentMessages.forEach(localMsg => {
          const existsInServer = filteredMessages.some(serverMsg => 
            serverMsg.messageId === localMsg.messageId || 
            (serverMsg.reqId && localMsg.reqId && serverMsg.reqId === localMsg.reqId)
          );
          
          if (!existsInServer) {
            console.log('Adding local message not yet on server:', localMsg.message || 'File message');
            finalMessages.push(localMsg);
          }
        });
        
        finalMessages.sort((a, b) => a.createdAt - b.createdAt);
      }
      
      setMessages(finalMessages);
      
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
      
      const userIds = [currentUser.userId, targetUser.userId]; // Current user and selected user
      const channelName = `${currentUser.nickname} & ${targetUser.nickname} Chat`;
      
      console.log('Creating/getting channel for userIds:', userIds);
      
      const newChannel = await sendbirdService.createOrGetChannel(userIds, channelName);
      console.log('Channel obtained:', newChannel.url);
      
      const isSameChannel = channel && channel.url === newChannel.url;
      
      setChannel(newChannel);
      setSelectedUser(targetUser);
      setUnreadCount(0);
      
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

  // Common regex patterns for emails and phone numbers
  // Note: These are basic patterns and may not cover all formats or be perfect.
  const emailRegex = /[\w._%+-]+@[\w.-]+\.[\w]{2,}/;
  const phoneRegex = /(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
  // Regex pattern for common spam/shortened links
  const spamLinkRegex = /\b(?:https?:\/\/)?(?:www\.)?(?:bit\.ly|tinyurl|shorturl|t\.co|goo\.gl|ow\.ly|buff\.ly)\/\w+/;

  const sendMessage = async (messageText) => {
    if (!channel || !messageText.trim()) {
      console.log('Cannot send message - no channel or empty message');
      return;
    }

    if (isChatBlocked) {
      console.log('Chat is blocked for this user.');
      return;
    }

    const trimmedMessage = messageText.trim();

    // Client-side check for personal information or spam links
    if (emailRegex.test(trimmedMessage) || phoneRegex.test(trimmedMessage)) {
      setErrorDialogMessage('DO not share personal information trying to go off platform');
      setShowErrorDialog(true);
      setProfanityErrorCount(prevCount => {
        const newCount = prevCount + 1;
        if (newCount >= 3) {
          setIsChatBlocked(true);
        }
        return newCount;
      });
      console.log('Client-side block: Personal information detected. Error count:', profanityErrorCount + 1);
      return; // Stop here, do not send the message
    }

    if (spamLinkRegex.test(trimmedMessage)) {
      setErrorDialogMessage('Trying to send malware or spam links is not allowed.');
      setShowErrorDialog(true);
      setProfanityErrorCount(prevCount => {
        const newCount = prevCount + 1;
        if (newCount >= 3) {
          setIsChatBlocked(true);
        }
        return newCount;
      });
      console.log('Client-side block: Spam link detected. Error count:', profanityErrorCount + 1);
      return; // Stop here, do not send the message
    }

    try {
      console.log('Sending message:', trimmedMessage);
      const message = await sendbirdService.sendMessage(trimmedMessage);
      console.log('Message sent successfully:', message);

      setProfanityErrorCount(0);

      // Immediately add the sent message to the local state for instant feedback
      setMessages(prevMessages => {
        // Check if the message already exists (e.g., if the global handler processed it very quickly)
        const exists = prevMessages.some(msg => 
          msg.messageId === message.messageId || 
          (msg.reqId && message.reqId && msg.reqId === message.reqId)
        );
        
        if (!exists) {
          return [...prevMessages, message];
        } else {
          // If it exists, find and update it (e.g., replace temporary message with server-acked one)
          return prevMessages.map(msg => 
            (msg.reqId && message.reqId && msg.reqId === message.reqId) || msg.messageId === message.messageId
            ? message : msg
          );
        }
      });

      // Auto-scroll after sending message
      // This is now handled by the useEffect in MessageList

    } catch (error) {
      console.error('Failed to send message:', error.message);
      // Check if the error is due to the profanity filter
      // Since we did client-side checks for personal info,
      // any block error from Sendbird is now likely for general profanity
      if (error.message && error.message.includes('blocked by profanity filter')) {
        setErrorDialogMessage('Profanity is blocked by the application. Please remove offensive words.');
        setShowErrorDialog(true);
        setProfanityErrorCount(prevCount => {
          const newCount = prevCount + 1;
          if (newCount >= 3) {
            setIsChatBlocked(true);
          } else {
             // Maybe hide dialog after a delay if not blocked?
          }
          return newCount;
        });
        console.log('Sendbird block: Profanity detected. Error count:', profanityErrorCount + 1);
      } else {
        // Handle other potential sending errors
        setErrorDialogMessage('Failed to send message: ' + error.message);
        setShowErrorDialog(true);
      }
    }
  };

  // File upload handler
  const sendFile = async (file, fileType, progressCallback) => {
    if (!channel || !file) {
      console.log('Cannot send file - no channel or file');
      return;
    }

    try {
      console.log('Sending file:', file.name, 'Type:', fileType);
      
      let fileMessage;
      
      // Handle different file types
      switch (fileType) {
        case 'image':
          fileMessage = await sendbirdService.uploadImage(file);
          break;
        case 'video':
          fileMessage = await sendbirdService.uploadVideo(file);
          break;
        case 'audio':
          fileMessage = await sendbirdService.uploadAudio(file);
          break;
        case 'document':
          fileMessage = await sendbirdService.uploadDocument(file);
          break;
        default:
          fileMessage = await sendbirdService.uploadFile(file);
      }

      console.log('File sent successfully:', fileMessage);
      
      // Add file message to local state immediately
      setMessages(prevMessages => {
        const exists = prevMessages.some(msg => 
          msg.messageId === fileMessage.messageId || 
          (msg.reqId && fileMessage.reqId && msg.reqId === fileMessage.reqId)
        );
        
        if (exists) {
          return prevMessages;
        }
        
        return [...prevMessages, fileMessage];
      });
      
    } catch (error) {
      console.error('Failed to send file:', error);
      throw error; // Re-throw so MessageInput can handle it
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

  const handleMessageClick = (message) => {
    setSelectedMessage(message);
    setShowModerationPanel(true);
  };

  const handleModerationAction = (action, data) => {
    console.log('Moderation action:', action, data);
    // Refresh messages if needed
    if (channel) {
      loadMessages(channel, true);
    }
  };

  const handleDateConfirmed = (date) => {
    setConfirmedDate(date);
    // Send the date as a message in the chat
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    sendMessage(`📅 Date confirmed: ${formattedDate}`);
    // Optionally, clear the confirmed date after some time
    // setTimeout(() => setConfirmedDate(null), 5000); // Clear after 5 seconds
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
        {channel && selectedUser && (
          <div className="channel-info">
            <h3>
              Chatting with {selectedUser.nickname}
              {(onlineUsers.has(selectedUser.userId)) && (
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
          {(() => {
            let userListHeader = 'Available Users'; // Default for agents
            if (currentUser.userId === 'user1') { // Alice (Brand)
              userListHeader = 'Order Accepted  ✔';
            } else if (currentUser.userId === 'user2') { // Bob (Influencer)
              userListHeader = 'Order Accepted  ✔';
            }

            return (
              <UserList 
                users={users} 
                onUserSelect={startChat}
                loading={loading}
                selectedUser={selectedUser}
                onlineUsers={onlineUsers}
                unreadCounts={unreadCount}
                headerText={userListHeader}
              />
            );
          })()}
        </div>

        <div className="messages-panel">
          {channel ? (
            <>
              <MessageList 
                messages={messages} 
                currentUser={currentUser}
                onMessageClick={handleMessageClick}
              />
              {isChatBlocked ? (
                <div className="chat-blocked-message">
                  <p>You have been blocked from sending messages due to repeated policy violations.</p>
                  <p>Please contact customer care for assistance.</p>
                </div>
              ) : (
                <MessageInput 
                  onSendMessage={sendMessage}
                  onSendFile={sendFile}
                  disabled={loading || isChatBlocked}
                  onDateConfirmed={handleDateConfirmed}
                />
              )}
            </>
          ) : (
            <div className="no-chat">
              {currentUser.userId === 'user1' ? (
                <p>Purchase a package to start chatting!</p>
              ) : (
                <p>Select a user from the left panel to start chatting!</p>
              )}
            </div>
          )}
        </div>
      </div>

      {showModerationPanel && selectedMessage && (
        <ModerationPanel
          message={selectedMessage}
          channel={channel}
          currentUser={currentUser}
          onClose={() => {
            setShowModerationPanel(false);
            setSelectedMessage(null);
          }}
          onModerationAction={handleModerationAction}
        />
      )}

      {showErrorDialog && (
        <ErrorDialog 
          message={errorDialogMessage}
          onClose={() => setShowErrorDialog(false)}
        />
      )}

      {confirmedDate && (
        <div className="date-confirmed-indicator">
          <p>Confirmed Date:</p>
          <p>{confirmedDate.toLocaleDateString()}</p>
        </div>
      )}
    </div>
  );
};

export default ChatRoom;