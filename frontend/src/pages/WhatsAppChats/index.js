import React, { useState, useEffect, useContext, useRef } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Paper,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  TextField,
  IconButton,
  Box,
  Badge,
  Divider,
  InputAdornment,
  CircularProgress,
  Chip
} from "@material-ui/core";
import {
  Send as SendIcon,
  Search as SearchIcon,
  AttachFile as AttachFileIcon,
  EmojiEmotions as EmojiIcon,
  MoreVert as MoreVertIcon
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import { socketManager } from "../../context/Socket/SocketContext";
import { format, isToday, isYesterday } from "date-fns";
import whatsBackground from "../../assets/wa-background.png";

const useStyles = makeStyles((theme) => ({
  root: {
    height: "calc(100vh - 64px)",
    display: "flex",
    flexDirection: "column",
  },
  chatContainer: {
    display: "flex",
    height: "100%",
    backgroundColor: theme.palette.background.paper,
  },
  contactsList: {
    width: 350,
    borderRight: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
  },
  searchBox: {
    padding: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  contactsListContainer: {
    flex: 1,
    overflowY: "auto",
  },
  contactItem: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    cursor: "pointer",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  selectedContact: {
    backgroundColor: theme.palette.action.selected,
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  chatHeader: {
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: "flex",
    alignItems: "center",
    backgroundColor: theme.palette.background.paper,
  },
  messagesContainer: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(1),
    backgroundImage: `url(${whatsBackground})`,
    backgroundSize: "cover",
    backgroundRepeat: "repeat",
  },
  messageInput: {
    padding: theme.spacing(1),
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  messageItem: {
    marginBottom: theme.spacing(1),
    display: "flex",
    flexDirection: "column",
  },
  messageFromMe: {
    alignItems: "flex-end",
  },
  messageFromOther: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "70%",
    padding: theme.spacing(1, 1.5),
    borderRadius: 8,
    wordBreak: "break-word",
  },
  messageBubbleFromMe: {
    backgroundColor: "#dcf8c6",
    color: "#000",
  },
  messageBubbleFromOther: {
    backgroundColor: "#fff",
    color: "#000",
  },
  messageTime: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  emptyChat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: theme.palette.text.secondary,
  },
  unreadBadge: {
    backgroundColor: "#25d366",
    color: "white",
  },
  onlineIndicator: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    backgroundColor: "#4caf50",
    position: "absolute",
    bottom: 2,
    right: 2,
    border: `2px solid ${theme.palette.background.paper}`,
  },
  lastMessageTime: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
  },
  mediaMessage: {
    fontStyle: "italic",
    color: theme.palette.text.secondary,
  },
}));

const WhatsAppChats = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const messagesEndRef = useRef(null);

  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messagesPage, setMessagesPage] = useState(1);

  useEffect(() => {
    fetchContacts();
  }, [searchTerm]);

  useEffect(() => {
    if (selectedContact?.id) {
      fetchMessages(selectedContact.id, 1);
    }
  }, [selectedContact?.id]); // Only depend on the ID to prevent loops

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // WebSocket for real-time message updates
  useEffect(() => {
    const socket = socketManager.GetSocket();
    
    const handleNewMessage = (data) => {
      if (data.action === "create" && data.message) {
        const message = data.message;
        
        // Update messages if this contact is selected
        if (selectedContact?.id && message.contactId === selectedContact.id) {
          setMessages(prev => {
            // Check if message already exists to prevent duplicates
            const exists = prev.find(m => m.id === message.id);
            if (exists) return prev;
            return [...prev, message];
          });
        }
        
        // Update contact list with new last message
        setContacts(prev => 
          prev.map(contact => 
            contact.id === message.contactId 
              ? {
                  ...contact,
                  lastMessage: {
                    body: message.body,
                    fromMe: message.fromMe,
                    createdAt: message.createdAt,
                    mediaType: message.mediaType
                  },
                  unreadCount: message.fromMe ? contact.unreadCount : (contact.unreadCount || 0) + 1
                }
              : contact
          )
        );
      }
    };

    socket.on(`company-${user.companyId}-message`, handleNewMessage);

    return () => {
      socket.off(`company-${user.companyId}-message`, handleNewMessage);
    };
  }, [user.companyId, selectedContact?.id]); // Only depend on selectedContact.id

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/whatsapp-chats", {
        params: { searchParam: searchTerm }
      });
      setContacts(data.contacts || []);
    } catch (error) {
      console.error("Error fetching contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (contactId, page = 1) => {
    if (!contactId) return;
    
    setMessagesLoading(true);
    try {
      const { data } = await api.get(`/whatsapp-chats/${contactId}/messages`, {
        params: { pageNumber: page }
      });
      
      if (page === 1) {
        setMessages(data.messages || []);
        // Only update selectedContact if we don't have one or it's different
        if (!selectedContact || selectedContact.id !== contactId) {
          setSelectedContact(prev => ({ ...prev, ...data.contact }));
        }
      } else {
        setMessages(prev => [...(data.messages || []), ...prev]);
      }
      
      setHasMoreMessages(data.hasMore);
      setMessagesPage(page);
      
      // Update unread count for this contact
      setContacts(prev => 
        prev.map(contact => 
          contact.id === contactId 
            ? { ...contact, unreadCount: 0 }
            : contact
        )
      );
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedContact) return;

    try {
      await api.post(`/whatsapp-chats/${selectedContact.id}/messages`, {
        message: messageText
      });
      
      setMessageText("");
      // The message will be added via WebSocket when it's actually sent
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleContactSelect = (contact) => {
    // Prevent selecting the same contact multiple times
    if (selectedContact?.id === contact.id) return;
    
    setSelectedContact(contact);
    setMessages([]);
    setMessagesPage(1);
  };

  const loadMoreMessages = () => {
    if (hasMoreMessages && !messagesLoading && selectedContact) {
      fetchMessages(selectedContact.id, messagesPage + 1);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const formatMessageTime = (date) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) {
      return format(messageDate, "HH:mm");
    } else if (isYesterday(messageDate)) {
      return "Yesterday";
    } else {
      return format(messageDate, "dd/MM/yyyy");
    }
  };

  const getMessagePreview = (message) => {
    if (!message) return "No messages yet";
    
    if (message.mediaType) {
      switch (message.mediaType) {
        case "image": return "📷 Image";
        case "video": return "🎥 Video";
        case "audio": return "🎵 Audio";
        case "document": return "📄 Document";
        default: return "📎 Media";
      }
    }
    
    return message.body || "Message";
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>WhatsApp Chats</Title>
      </MainHeader>
      
      <Paper className={classes.root}>
        <div className={classes.chatContainer}>
          {/* Contacts List */}
          <div className={classes.contactsList}>
            <div className={classes.searchBox}>
              <TextField
                fullWidth
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                variant="outlined"
                size="small"
              />
            </div>
            
            <div className={classes.contactsListContainer}>
              {loading ? (
                <Box display="flex" justifyContent="center" p={2}>
                  <CircularProgress />
                </Box>
              ) : (
                <List>
                  {contacts.map((contact) => (
                    <ListItem
                      key={contact.id}
                      className={`${classes.contactItem} ${
                        selectedContact?.id === contact.id ? classes.selectedContact : ""
                      }`}
                      onClick={() => handleContactSelect(contact)}
                    >
                      <ListItemAvatar>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                          badgeContent={
                            contact.unreadCount > 0 ? (
                              <Chip
                                size="small"
                                label={contact.unreadCount}
                                className={classes.unreadBadge}
                              />
                            ) : null
                          }
                        >
                          <Avatar src={contact.profilePicUrl}>
                            {contact.name?.charAt(0)?.toUpperCase()}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle1" noWrap>
                              {contact.name || contact.number}
                            </Typography>
                            {contact.lastMessage && (
                              <Typography className={classes.lastMessageTime}>
                                {formatMessageTime(contact.lastMessage.createdAt)}
                              </Typography>
                            )}
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" color="textSecondary" noWrap>
                            {contact.lastMessage?.fromMe && "You: "}
                            {getMessagePreview(contact.lastMessage)}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={classes.chatArea}>
            {selectedContact ? (
              <>
                {/* Chat Header */}
                <div className={classes.chatHeader}>
                  <Avatar src={selectedContact.profilePicUrl} style={{ marginRight: 16 }}>
                    {selectedContact.name?.charAt(0)?.toUpperCase()}
                  </Avatar>
                  <Box flex={1}>
                    <Typography variant="h6">
                      {selectedContact.name || selectedContact.number}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {selectedContact.presence === "available" ? "Online" : "Last seen recently"}
                    </Typography>
                  </Box>
                  <IconButton>
                    <MoreVertIcon />
                  </IconButton>
                </div>

                {/* Messages */}
                <div className={classes.messagesContainer}>
                  {hasMoreMessages && (
                    <Box display="flex" justifyContent="center" p={1}>
                      <IconButton onClick={loadMoreMessages} disabled={messagesLoading}>
                        {messagesLoading ? <CircularProgress size={20} /> : "Load more"}
                      </IconButton>
                    </Box>
                  )}
                  
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`${classes.messageItem} ${
                        message.fromMe ? classes.messageFromMe : classes.messageFromOther
                      }`}
                    >
                      <div
                        className={`${classes.messageBubble} ${
                          message.fromMe ? classes.messageBubbleFromMe : classes.messageBubbleFromOther
                        }`}
                      >
                        {message.quotedMsg && (
                          <Box
                            p={1}
                            mb={1}
                            bgcolor="rgba(0,0,0,0.1)"
                            borderRadius={4}
                            borderLeft="3px solid #25d366"
                          >
                            <Typography variant="caption" color="textSecondary">
                              {message.quotedMsg.body}
                            </Typography>
                          </Box>
                        )}
                        
                        {message.mediaType && (
                          <Box mb={1}>
                            {message.mediaType === "image" && message.mediaUrl && (
                              <img
                                src={message.mediaUrl}
                                alt="Media"
                                style={{ maxWidth: "100%", borderRadius: 8 }}
                              />
                            )}
                            {message.mediaType !== "image" && (
                              <Typography className={classes.mediaMessage}>
                                {getMessagePreview(message)}
                              </Typography>
                            )}
                          </Box>
                        )}
                        
                        <Typography variant="body1">
                          {message.body}
                        </Typography>
                        
                        <Typography className={classes.messageTime}>
                          {formatMessageTime(message.createdAt)}
                          {message.fromMe && (
                            <span style={{ marginLeft: 4 }}>
                              {message.ack === 1 && "✓"}
                              {message.ack === 2 && "✓✓"}
                              {message.ack === 3 && <span style={{ color: "#4fc3f7" }}>✓✓</span>}
                            </span>
                          )}
                        </Typography>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className={classes.messageInput}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <IconButton>
                      <AttachFileIcon />
                    </IconButton>
                    <TextField
                      fullWidth
                      placeholder="Type a message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      multiline
                      maxRows={4}
                      variant="outlined"
                      size="small"
                    />
                    <IconButton>
                      <EmojiIcon />
                    </IconButton>
                    <IconButton 
                      color="primary" 
                      onClick={handleSendMessage}
                      disabled={!messageText.trim()}
                    >
                      <SendIcon />
                    </IconButton>
                  </Box>
                </div>
              </>
            ) : (
              <div className={classes.emptyChat}>
                <Typography variant="h6" gutterBottom>
                  Select a contact to start chatting
                </Typography>
                <Typography variant="body2">
                  Choose a contact from the list to view your conversation history
                </Typography>
              </div>
            )}
          </div>
        </div>
      </Paper>
    </MainContainer>
  );
};

export default WhatsAppChats;