import { Request, Response } from "express";
import { Op } from "sequelize";
import * as Yup from "yup";

import BulkCampaign from "../models/BulkCampaign";
import BulkMessage from "../models/BulkMessage";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
import ContactTag from "../models/ContactTag";
import Tag from "../models/Tag";
import AppError from "../errors/AppError";
import { getIO } from "../libs/socket";
import BulkMessageService from "../services/BulkMessageService";

interface BulkCampaignData {
  name: string;
  message?: string;
  whatsappIds: number[];
  tagIds: number[];
  sendToAll: boolean;
  messagesPerHour: number;
  minDelay: number;
  maxDelay: number;
  companyId: number;
  mediaPath?: string;
  mediaName?: string;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { pageNumber = "1" } = req.query;

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: campaigns } = await BulkCampaign.findAndCountAll({
    where: { companyId },
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: BulkMessage,
        as: "messages",
        attributes: ["id", "status"],
        required: false
      }
    ]
  });

  const hasMore = count > offset + campaigns.length;

  return res.json({
    campaigns,
    count,
    hasMore
  });
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  const campaign = await BulkCampaign.findOne({
    where: { id, companyId },
    include: [
      {
        model: BulkMessage,
        as: "messages",
        include: [
          { model: Contact, as: "contact" },
          { model: Whatsapp, as: "whatsapp" }
        ]
      }
    ]
  });

  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  return res.json(campaign);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = req.body as BulkCampaignData;
  const files = req.files as Express.Multer.File[];

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    whatsappIds: Yup.array().of(Yup.number()).min(1).required(),
    messagesPerHour: Yup.number().min(1).max(100).required(),
    minDelay: Yup.number().min(1).required(),
    maxDelay: Yup.number().min(1).required()
  });

  try {
    await schema.validate(data);
  } catch (err) {
    throw new AppError(err.message);
  }

  // Validate that we have either message or media
  if (!data.message && (!files || files.length === 0)) {
    throw new AppError("Either message text or media file is required");
  }

  // Handle media upload
  let mediaPath = "";
  let mediaName = "";
  if (files && files.length > 0) {
    const file = files[0];
    // Store only the filename, not the full path
    mediaPath = file.filename;
    mediaName = file.filename;
  }

  // Parse JSON strings and convert boolean
  const whatsappIds = typeof data.whatsappIds === 'string' 
    ? JSON.parse(data.whatsappIds) 
    : data.whatsappIds;
  const tagIds = typeof data.tagIds === 'string' 
    ? JSON.parse(data.tagIds) 
    : data.tagIds;
  
  // Convert sendToAll to boolean if it's a string
  const sendToAll = typeof data.sendToAll === 'string' 
    ? data.sendToAll === 'true' 
    : data.sendToAll;

  // Get contacts based on criteria
  let contacts: Contact[] = [];
  
  if (sendToAll) {
    contacts = await Contact.findAll({
      where: { companyId },
      attributes: ['id', 'name', 'number']
    });
  } else if (tagIds && tagIds.length > 0) {
    // Get contacts with specific tags using raw SQL for accuracy
    const { QueryTypes } = require("sequelize");
    const sequelize = require("../database/index").default;
    
    const result = await sequelize.query(`
      SELECT DISTINCT c.id, c.name, c.number
      FROM "Contacts" c
      INNER JOIN "ContactTags" ct ON c.id = ct."contactId"
      WHERE c."companyId" = $1 
      AND ct."tagId" = ANY($2)
    `, {
      bind: [companyId, tagIds],
      type: QueryTypes.SELECT
    });
    
    contacts = result;
  }

  if (contacts.length === 0) {
    throw new AppError("No contacts found for the specified criteria");
  }

  // Create bulk campaign
  const campaign = await BulkCampaign.create({
    ...data,
    sendToAll, // Use the parsed boolean value
    whatsappIds,
    tagIds,
    companyId,
    mediaPath,
    mediaName,
    totalContacts: contacts.length,
    status: "PENDING"
  });

  // Create bulk messages for each contact
  const bulkMessages = [];
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const whatsappId = whatsappIds[i % whatsappIds.length]; // Load balancing

    bulkMessages.push({
      bulkCampaignId: campaign.id,
      contactId: contact.id,
      whatsappId,
      message: data.message || "",
      mediaPath,
      status: "PENDING"
    });
  }

  await BulkMessage.bulkCreate(bulkMessages);

  // Start processing the campaign
  BulkMessageService.processCampaign(campaign.id);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-bulk-campaign`, {
    action: "create",
    campaign
  });

  return res.status(201).json(campaign);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;
  const data = req.body;

  const campaign = await BulkCampaign.findOne({
    where: { id, companyId }
  });

  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  if (campaign.status === "RUNNING") {
    throw new AppError("Cannot update a running campaign", 400);
  }

  await campaign.update(data);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-bulk-campaign`, {
    action: "update",
    campaign
  });

  return res.json(campaign);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  const campaign = await BulkCampaign.findOne({
    where: { id, companyId }
  });

  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  if (campaign.status === "RUNNING") {
    throw new AppError("Cannot delete a running campaign. Stop it first.", 400);
  }

  await campaign.destroy();

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-bulk-campaign`, {
    action: "delete",
    campaignId: id
  });

  return res.json({ message: "Campaign deleted successfully" });
};

export const pause = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  const campaign = await BulkCampaign.findOne({
    where: { id, companyId }
  });

  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  if (campaign.status !== "RUNNING") {
    throw new AppError("Can only pause running campaigns", 400);
  }

  await campaign.update({ status: "PAUSED" });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-bulk-campaign`, {
    action: "update",
    campaign
  });

  return res.json({ message: "Campaign paused successfully" });
};

export const resume = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  const campaign = await BulkCampaign.findOne({
    where: { id, companyId }
  });

  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  if (campaign.status !== "PAUSED") {
    throw new AppError("Can only resume paused campaigns", 400);
  }

  await campaign.update({ status: "RUNNING" });

  // Resume processing the campaign
  BulkMessageService.processCampaign(campaign.id);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-bulk-campaign`, {
    action: "update",
    campaign
  });

  return res.json({ message: "Campaign resumed successfully" });
};

export const stop = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  const campaign = await BulkCampaign.findOne({
    where: { id, companyId }
  });

  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  await campaign.update({ 
    status: "CANCELLED",
    completedAt: new Date()
  });

  // Update pending messages to cancelled
  await BulkMessage.update(
    { status: "CANCELLED" },
    { 
      where: { 
        bulkCampaignId: id,
        status: "PENDING"
      }
    }
  );

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-bulk-campaign`, {
    action: "update",
    campaign
  });

  return res.json({ message: "Campaign stopped successfully" });
};

export const getActive = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const campaigns = await BulkCampaign.findAll({
    where: { 
      companyId,
      status: { [Op.in]: ["PENDING", "RUNNING", "PAUSED"] }
    },
    order: [["createdAt", "DESC"]],
    attributes: [
      "id", 
      "name", 
      "status", 
      "totalContacts", 
      "sentCount", 
      "deliveredCount", 
      "failedCount",
      "createdAt"
    ]
  });

  const activeCampaigns = campaigns.map(campaign => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    total: campaign.totalContacts,
    sent: campaign.sentCount,
    delivered: campaign.deliveredCount,
    failed: campaign.failedCount,
    createdAt: campaign.createdAt
  }));

  return res.json(activeCampaigns);
};

export const getAll = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const campaigns = await BulkCampaign.findAll({
    where: { companyId },
    order: [["createdAt", "DESC"]],
    attributes: [
      "id", 
      "name", 
      "status", 
      "totalContacts", 
      "sentCount", 
      "deliveredCount", 
      "failedCount",
      "createdAt",
      "completedAt"
    ]
  });

  const allCampaigns = campaigns.map(campaign => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    total: campaign.totalContacts,
    sent: campaign.sentCount,
    delivered: campaign.deliveredCount,
    failed: campaign.failedCount,
    createdAt: campaign.createdAt,
    completedAt: campaign.completedAt
  }));

  return res.json(allCampaigns);
};

export const getDetails = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  const campaign = await BulkCampaign.findOne({
    where: { id, companyId }
  });

  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  // Get message details with contact information
  const messages = await BulkMessage.findAll({
    where: { bulkCampaignId: id },
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number"]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name"]
      }
    ],
    order: [["createdAt", "ASC"]]
  });

  const campaignDetails = {
    id: campaign.id,
    name: campaign.name,
    message: campaign.message,
    mediaPath: campaign.mediaPath,
    status: campaign.status,
    totalContacts: campaign.totalContacts,
    sentCount: campaign.sentCount,
    deliveredCount: campaign.deliveredCount,
    failedCount: campaign.failedCount,
    messagesPerHour: campaign.messagesPerHour,
    createdAt: campaign.createdAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    messages: messages.map(msg => ({
      id: msg.id,
      status: msg.status,
      sentAt: msg.sentAt,
      errorMessage: msg.errorMessage,
      contact: msg.contact,
      whatsapp: msg.whatsapp
    }))
  };

  return res.json(campaignDetails);
};