import React, { useState, useEffect, useContext } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Chip from "@material-ui/core/Chip";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardActions from "@material-ui/core/CardActions";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import LinearProgress from "@material-ui/core/LinearProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import RadioGroup from "@material-ui/core/RadioGroup";
import Radio from "@material-ui/core/Radio";
import FormLabel from "@material-ui/core/FormLabel";

import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import SendIcon from "@material-ui/icons/Send";
import DeleteIcon from "@material-ui/icons/Delete";
import StopIcon from "@material-ui/icons/Stop";
import PeopleIcon from "@material-ui/icons/People";
import ImageIcon from "@material-ui/icons/Image";
import MessageIcon from "@material-ui/icons/Message";
import AddIcon from "@material-ui/icons/Add";
import CloseIcon from "@material-ui/icons/Close";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { socketManager } from "../../context/Socket/SocketContext";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(3),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  formControl: {
    minWidth: 120,
    width: "100%",
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
  },
  chip: {
    margin: 2,
  },
  uploadButton: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  previewImage: {
    maxWidth: "100%",
    maxHeight: 200,
    marginTop: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
  },
  campaignCard: {
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
  },
  antibanSettings: {
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    marginTop: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
  },
  sectionTitle: {
    marginBottom: theme.spacing(2),
    color: theme.palette.primary.main,
    fontWeight: 600,
  },
  contactCounter: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    padding: theme.spacing(1, 2),
    borderRadius: theme.shape.borderRadius,
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  progressCard: {
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.paper,
  },
  statusChip: {
    fontWeight: 600,
  },
  uploadArea: {
    border: `2px dashed ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 0.3s",
    "&:hover": {
      borderColor: theme.palette.primary.main,
    },
  },
  mediaPreview: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
    padding: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
  },
  emptyState: {
    textAlign: "center",
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  createButton: {
    marginBottom: theme.spacing(2),
  },
  dialogContent: {
    minWidth: 600,
  },
  targetingSection: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  whatsappSection: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
}));

const BulkMessaging = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [whatsapps, setWhatsapps] = useState([]);
  const [tags, setTags] = useState([]);
  const [contactCount, setContactCount] = useState(0);
  const [allCampaigns, setAllCampaigns] = useState([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignDetails, setCampaignDetails] = useState(null);

  // Campaign form state
  const [campaignName, setCampaignName] = useState("");
  const [messageText, setMessageText] = useState("");
  const [selectedWhatsapps, setSelectedWhatsapps] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [targetingMode, setTargetingMode] = useState("all"); // "all" or "tags"
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  // Anti-ban settings
  const [messagesPerHour, setMessagesPerHour] = useState(30);
  const [minDelay, setMinDelay] = useState(5);
  const [maxDelay, setMaxDelay] = useState(15);

  useEffect(() => {
    fetchWhatsapps();
    fetchTags();
    fetchAllCampaigns();
  }, []);

  useEffect(() => {
    fetchContactCount();
  }, [selectedTags, targetingMode]);

  // WebSocket for real-time updates
  useEffect(() => {
    const socket = socketManager.GetSocket();
    
    const handleBulkCampaignUpdate = (data) => {
      console.log("Bulk campaign update received:", data);
      
      if (data.action === "update" || data.action === "create") {
        // Refresh campaigns list
        fetchAllCampaigns();
      } else if (data.action === "message-sent" || data.action === "message-failed") {
        // Update specific campaign in real-time
        setAllCampaigns(prevCampaigns => 
          prevCampaigns.map(campaign => 
            campaign.id === data.campaignId 
              ? { 
                  ...campaign, 
                  sent: data.sentCount || campaign.sent,
                  failed: data.failedCount || campaign.failed
                }
              : campaign
          )
        );
        
        // If details dialog is open for this campaign, refresh details
        if (selectedCampaign && selectedCampaign.id === data.campaignId) {
          handleViewDetails(selectedCampaign);
        }
      }
    };

    socket.on(`company-${user.companyId}-bulk-campaign`, handleBulkCampaignUpdate);

    return () => {
      socket.off(`company-${user.companyId}-bulk-campaign`, handleBulkCampaignUpdate);
    };
  }, [user.companyId, selectedCampaign]);

  const fetchWhatsapps = async () => {
    try {
      const { data } = await api.get("/whatsapp");
      setWhatsapps(data.filter(w => w.status === "CONNECTED"));
    } catch (err) {
      toastError(err);
    }
  };

  const fetchTags = async () => {
    try {
      const { data } = await api.get("/tags");
      setTags(data.tags || []);
    } catch (err) {
      toastError(err);
    }
  };

  const fetchContactCount = async () => {
    try {
      let url = "/contacts/count";
      let params = {};
      
      if (targetingMode === "tags" && selectedTags.length > 0) {
        params.tags = selectedTags.join(",");
      }
      
      const { data } = await api.get(url, { params });
      setContactCount(data.count || 0);
    } catch (err) {
      console.error("Error fetching contact count:", err);
      setContactCount(0);
    }
  };

  const fetchAllCampaigns = async () => {
    try {
      const { data } = await api.get("/bulk-campaigns/all");
      setAllCampaigns(data || []);
    } catch (err) {
      console.error("Error fetching campaigns:", err);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = (e) => setPreviewUrl(e.target.result);
        reader.readAsDataURL(file);
      } else {
        toast.error("Please select an image file");
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl("");
  };

  const handleOpenCreateDialog = () => {
    setCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    // Reset form
    setCampaignName("");
    setMessageText("");
    setSelectedWhatsapps([]);
    setSelectedTags([]);
    setTargetingMode("all");
    setSelectedFile(null);
    setPreviewUrl("");
  };

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      toast.error("Campaign name is required");
      return;
    }

    if (!messageText.trim() && !selectedFile) {
      toast.error("Please provide either a message or an image");
      return;
    }

    if (selectedWhatsapps.length === 0) {
      toast.error("Please select at least one WhatsApp connection");
      return;
    }

    if (targetingMode === "tags" && selectedTags.length === 0) {
      toast.error("Please select tags or choose to send to all contacts");
      return;
    }

    if (contactCount === 0) {
      toast.error("No contacts found for the selected criteria");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("name", campaignName);
      formData.append("message", messageText);
      formData.append("whatsappIds", JSON.stringify(selectedWhatsapps));
      formData.append("tagIds", JSON.stringify(targetingMode === "all" ? [] : selectedTags));
      formData.append("sendToAll", targetingMode === "all");
      formData.append("messagesPerHour", messagesPerHour);
      formData.append("minDelay", minDelay);
      formData.append("maxDelay", maxDelay);

      if (selectedFile) {
        formData.append("media", selectedFile);
      }

      await api.post("/bulk-campaigns", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Bulk messaging campaign created successfully!");
      handleCloseCreateDialog();
      fetchAllCampaigns();
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePauseCampaign = async (campaignId) => {
    try {
      await api.post(`/bulk-campaigns/${campaignId}/pause`);
      toast.success("Campaign paused successfully");
      fetchAllCampaigns();
    } catch (err) {
      toastError(err);
    }
  };

  const handleResumeCampaign = async (campaignId) => {
    try {
      await api.post(`/bulk-campaigns/${campaignId}/resume`);
      toast.success("Campaign resumed successfully");
      fetchAllCampaigns();
    } catch (err) {
      toastError(err);
    }
  };

  const handleStopCampaign = async (campaignId) => {
    try {
      await api.post(`/bulk-campaigns/${campaignId}/stop`);
      toast.success("Campaign stopped successfully");
      fetchAllCampaigns();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    try {
      await api.delete(`/bulk-campaigns/${campaignId}`);
      toast.success("Campaign deleted successfully");
      fetchAllCampaigns();
    } catch (err) {
      toastError(err);
    }
  };

  const handleViewDetails = async (campaign) => {
    try {
      setSelectedCampaign(campaign);
      const { data } = await api.get(`/bulk-campaigns/${campaign.id}/details`);
      setCampaignDetails(data);
      setDetailsDialogOpen(true);
    } catch (err) {
      toastError(err);
    }
  };

  const handleCloseDetailsDialog = () => {
    setDetailsDialogOpen(false);
    setSelectedCampaign(null);
    setCampaignDetails(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "RUNNING": return "primary";
      case "COMPLETED": return "default";
      case "CANCELLED": return "secondary";
      case "PENDING": return "default";
      case "PAUSED": return "secondary";
      default: return "default";
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>Bulk Messaging</Title>
      </MainHeader>
      
      <Paper className={classes.mainPaper} variant="outlined">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            All Campaigns
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
            className={classes.createButton}
          >
            Create New Campaign
          </Button>
        </Box>

        {/* All Campaigns List */}
        {allCampaigns.length === 0 ? (
          <Card>
            <CardContent className={classes.emptyState}>
              <Typography variant="h6" gutterBottom>
                No campaigns found
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Create your first bulk messaging campaign to get started
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleOpenCreateDialog}
                style={{ marginTop: 16 }}
              >
                Create Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={2}>
            {allCampaigns.map((campaign) => (
              <Grid item xs={12} md={6} lg={4} key={campaign.id}>
                <Card className={classes.progressCard} elevation={2}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="h6" noWrap>
                        {campaign.name}
                      </Typography>
                      <Chip
                        label={campaign.status}
                        color={getStatusColor(campaign.status)}
                        size="small"
                        className={classes.statusChip}
                      />
                    </Box>
                    
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Progress: {campaign.sent}/{campaign.total}
                    </Typography>
                    
                    <LinearProgress
                      variant="determinate"
                      value={campaign.total > 0 ? (campaign.sent / campaign.total) * 100 : 0}
                      style={{ marginBottom: 8 }}
                    />
                    
                    <Typography variant="body2" color="textSecondary">
                      Success Rate: {campaign.sent > 0 ? ((campaign.delivered / campaign.sent) * 100).toFixed(1) : 0}%
                    </Typography>
                    
                    {campaign.completedAt && (
                      <Typography variant="body2" color="textSecondary" style={{ marginTop: 4 }}>
                        Completed: {new Date(campaign.completedAt).toLocaleString()}
                      </Typography>
                    )}
                  </CardContent>
                  
                  <CardActions>
                    <Button
                      size="small"
                      color="primary"
                      onClick={() => handleViewDetails(campaign)}
                    >
                      Details
                    </Button>
                    
                    {campaign.status === "RUNNING" && (
                      <Button
                        size="small"
                        color="secondary"
                        startIcon={<StopIcon />}
                        onClick={() => handlePauseCampaign(campaign.id)}
                      >
                        Pause
                      </Button>
                    )}
                    
                    {campaign.status === "PAUSED" && (
                      <Button
                        size="small"
                        color="primary"
                        startIcon={<SendIcon />}
                        onClick={() => handleResumeCampaign(campaign.id)}
                      >
                        Resume
                      </Button>
                    )}
                    
                    {(campaign.status === "RUNNING" || campaign.status === "PAUSED") && (
                      <Button
                        size="small"
                        color="secondary"
                        startIcon={<StopIcon />}
                        onClick={() => handleStopCampaign(campaign.id)}
                      >
                        Stop
                      </Button>
                    )}
                    
                    {(campaign.status === "COMPLETED" || campaign.status === "CANCELLED") && (
                      <Button
                        size="small"
                        color="secondary"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteCampaign(campaign.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Create Campaign Dialog */}
        <Dialog 
          open={createDialogOpen} 
          onClose={handleCloseCreateDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Create New Campaign</Typography>
              <Button
                onClick={handleCloseCreateDialog}
                color="default"
                size="small"
              >
                <CloseIcon />
              </Button>
            </Box>
          </DialogTitle>
          
          <DialogContent className={classes.dialogContent}>
            <Grid container spacing={3}>
              {/* Campaign Name */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Campaign Name"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  variant="outlined"
                  required
                />
              </Grid>

              {/* Message Content */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Message Text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  variant="outlined"
                  helperText="Optional - Leave empty if sending only images"
                  InputProps={{
                    startAdornment: <MessageIcon style={{ marginRight: 8, color: "#666" }} />
                  }}
                />
              </Grid>

              {/* Media Upload */}
              <Grid item xs={12}>
                <Box className={classes.uploadArea}>
                  <input
                    accept="image/*"
                    style={{ display: "none" }}
                    id="media-upload"
                    type="file"
                    onChange={handleFileSelect}
                  />
                  <label htmlFor="media-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<CloudUploadIcon />}
                      size="large"
                    >
                      Upload Image (Optional)
                    </Button>
                  </label>
                  
                  {previewUrl && (
                    <Box className={classes.mediaPreview}>
                      <ImageIcon color="primary" />
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className={classes.previewImage}
                        style={{ maxHeight: 100, maxWidth: 200 }}
                      />
                      <Button
                        size="small"
                        color="secondary"
                        startIcon={<DeleteIcon />}
                        onClick={handleRemoveFile}
                      >
                        Remove
                      </Button>
                    </Box>
                  )}
                </Box>
              </Grid>

              {/* WhatsApp Connections Section */}
              <Grid item xs={12}>
                <Box className={classes.whatsappSection}>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    WhatsApp Connections
                  </Typography>
                  <FormControl className={classes.formControl} variant="outlined">
                    <InputLabel>Select WhatsApp Connections *</InputLabel>
                    <Select
                      multiple
                      value={selectedWhatsapps}
                      onChange={(e) => setSelectedWhatsapps(e.target.value)}
                      renderValue={(selected) => (
                        <div className={classes.chips}>
                          {selected.map((value) => {
                            const whatsapp = whatsapps.find(w => w.id === value);
                            return (
                              <Chip
                                key={value}
                                label={whatsapp?.name || value}
                                className={classes.chip}
                                color="primary"
                                size="small"
                              />
                            );
                          })}
                        </div>
                      )}
                    >
                      {whatsapps.map((whatsapp) => (
                        <MenuItem key={whatsapp.id} value={whatsapp.id}>
                          {whatsapp.name} ({whatsapp.status})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Grid>

              {/* Target Audience Section */}
              <Grid item xs={12}>
                <Box className={classes.targetingSection}>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    Target Audience
                  </Typography>
                  
                  <FormControl component="fieldset">
                    <FormLabel component="legend">Send messages to:</FormLabel>
                    <RadioGroup
                      value={targetingMode}
                      onChange={(e) => setTargetingMode(e.target.value)}
                    >
                      <FormControlLabel
                        value="all"
                        control={<Radio color="primary" />}
                        label="All Contacts"
                      />
                      <FormControlLabel
                        value="tags"
                        control={<Radio color="primary" />}
                        label="Contacts with specific tags"
                      />
                    </RadioGroup>
                  </FormControl>

                  {targetingMode === "tags" && (
                    <FormControl className={classes.formControl} variant="outlined" style={{ marginTop: 16 }}>
                      <InputLabel>Select Tags</InputLabel>
                      <Select
                        multiple
                        value={selectedTags}
                        onChange={(e) => setSelectedTags(e.target.value)}
                        renderValue={(selected) => (
                          <div className={classes.chips}>
                            {selected.map((value) => {
                              const tag = tags.find(t => t.id === value);
                              return (
                                <Chip
                                  key={value}
                                  label={tag?.name || value}
                                  className={classes.chip}
                                  style={{ 
                                    backgroundColor: tag?.color || "#ccc",
                                    color: "#fff"
                                  }}
                                  size="small"
                                />
                              );
                            })}
                          </div>
                        )}
                      >
                        {tags.map((tag) => (
                          <MenuItem key={tag.id} value={tag.id}>
                            <Chip
                              label={tag.name}
                              style={{ 
                                backgroundColor: tag.color || "#ccc",
                                color: "#fff"
                              }}
                              size="small"
                            />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}

                  <Box className={classes.contactCounter}>
                    <PeopleIcon />
                    <Typography variant="h6">
                      Target Contacts: {contactCount}
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              {/* Anti-ban Settings */}
              <Grid item xs={12}>
                <Box className={classes.antibanSettings}>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    Anti-Ban Settings
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Messages per Hour"
                        value={messagesPerHour}
                        onChange={(e) => setMessagesPerHour(parseInt(e.target.value))}
                        inputProps={{ min: 1, max: 100 }}
                        variant="outlined"
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Min Delay (seconds)"
                        value={minDelay}
                        onChange={(e) => setMinDelay(parseInt(e.target.value))}
                        inputProps={{ min: 1 }}
                        variant="outlined"
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Max Delay (seconds)"
                        value={maxDelay}
                        onChange={(e) => setMaxDelay(parseInt(e.target.value))}
                        inputProps={{ min: minDelay + 1 }}
                        variant="outlined"
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          
          <DialogActions style={{ padding: 16 }}>
            <Button
              onClick={handleCloseCreateDialog}
              color="default"
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
              onClick={handleCreateCampaign}
              disabled={loading}
            >
              {loading ? "Creating..." : "Start Campaign"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Campaign Details Dialog */}
        <Dialog 
          open={detailsDialogOpen} 
          onClose={handleCloseDetailsDialog}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                Campaign Details: {selectedCampaign?.name}
              </Typography>
              <Button
                onClick={handleCloseDetailsDialog}
                color="default"
                size="small"
              >
                <CloseIcon />
              </Button>
            </Box>
          </DialogTitle>
          
          <DialogContent>
            {campaignDetails && (
              <Grid container spacing={3}>
                {/* Campaign Summary */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Campaign Summary</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="body2" color="textSecondary">Status</Typography>
                          <Chip 
                            label={campaignDetails.status} 
                            color={getStatusColor(campaignDetails.status)}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="body2" color="textSecondary">Total Contacts</Typography>
                          <Typography variant="h6">{campaignDetails.totalContacts}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="body2" color="textSecondary">Messages Sent</Typography>
                          <Typography variant="h6" color="primary">{campaignDetails.sentCount}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="body2" color="textSecondary">Failed</Typography>
                          <Typography variant="h6" color="error">{campaignDetails.failedCount}</Typography>
                        </Grid>
                      </Grid>
                      
                      <Box mt={2}>
                        <Typography variant="body2" color="textSecondary">Progress</Typography>
                        <LinearProgress
                          variant="determinate"
                          value={campaignDetails.totalContacts > 0 ? (campaignDetails.sentCount / campaignDetails.totalContacts) * 100 : 0}
                          style={{ marginTop: 8 }}
                        />
                      </Box>
                      
                      {campaignDetails.message && (
                        <Box mt={2}>
                          <Typography variant="body2" color="textSecondary">Message</Typography>
                          <Typography variant="body1" style={{ 
                            backgroundColor: '#f5f5f5', 
                            color: '#333',
                            padding: 8, 
                            borderRadius: 4,
                            marginTop: 4,
                            border: '1px solid #ddd'
                          }}>
                            {campaignDetails.message}
                          </Typography>
                        </Box>
                      )}
                      
                      {campaignDetails.mediaPath && (
                        <Box mt={2}>
                          <Typography variant="body2" color="textSecondary">Sent Image</Typography>
                          <Box mt={1}>
                            <img
                              src={`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080'}/public/${campaignDetails.mediaPath}`}
                              alt="Campaign media"
                              style={{
                                maxWidth: '100%',
                                maxHeight: 200,
                                borderRadius: 4,
                                border: '1px solid #ddd'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <Typography 
                              variant="body2" 
                              color="textSecondary"
                              style={{ display: 'none', marginTop: 8 }}
                            >
                              Image not available
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Message Details */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Message Details</Typography>
                      <Box style={{ maxHeight: 400, overflowY: 'auto' }}>
                        {campaignDetails.messages.map((message, index) => (
                          <Box 
                            key={message.id} 
                            display="flex" 
                            justifyContent="space-between" 
                            alignItems="center"
                            p={1}
                            style={{ 
                              borderBottom: index < campaignDetails.messages.length - 1 ? '1px solid #eee' : 'none'
                            }}
                          >
                            <Box>
                              <Typography variant="body2">
                                {message.contact?.name} ({message.contact?.number})
                              </Typography>
                              {message.sentAt && (
                                <Typography variant="caption" color="textSecondary">
                                  Sent: {new Date(message.sentAt).toLocaleString()}
                                </Typography>
                              )}
                              {message.errorMessage && (
                                <Typography variant="caption" color="error">
                                  Error: {message.errorMessage}
                                </Typography>
                              )}
                            </Box>
                            <Chip 
                              label={message.status} 
                              size="small"
                              color={
                                message.status === 'SENT' ? 'primary' : 
                                message.status === 'FAILED' ? 'secondary' : 'default'
                              }
                            />
                          </Box>
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          
          <DialogActions>
            <Button onClick={handleCloseDetailsDialog} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </MainContainer>
  );
};

export default BulkMessaging;