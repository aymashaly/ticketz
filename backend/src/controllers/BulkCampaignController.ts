import { Request, Response } from "express";
import { Op } from "sequelize";
import * as Yup from "yup";

import BulkCampaign from "../models/BulkCampaign";
import BulkMessage from "../models/BulkMessage";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
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

  // FormData sends everything as strings: parse JSON fields and
  // convert types BEFORE validating
  let whatsappIds: number[];
  let tagIds: number[];
  try {
    whatsappIds =
      typeof data.whatsappIds === "string"
        ? JSON.parse(data.whatsappIds)
        : data.whatsappIds;
    tagIds =
      typeof data.tagIds === "string" ? JSON.parse(data.tagIds) : data.tagIds;
  } catch (err) {
    throw new AppError("Invalid whatsappIds or tagIds");
  }

  const sendToAll =
    typeof data.sendToAll === "string"
      ? data.sendToAll === "true"
      : !!data.sendToAll;

  const messagesPerHour = Number(data.messagesPerHour);
  const minDelay = Number(data.minDelay);
  const maxDelay = Number(data.maxDelay);

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    whatsappIds: Yup.array().of(Yup.number()).min(1).required(),
    messagesPerHour: Yup.number().min(1).max(100).required(),
    minDelay: Yup.number().min(1).required(),
    maxDelay: Yup.number()
      .min(1)
      .required()
      .test(
        "max-gte-min",
        "maxDelay must be greater than or equal to minDelay",
        // eslint-disable-next-line func-names
        function (value) {
          return value >= this.parent.minDelay;
        }
      )
  });

  try {
    await schema.validate({
      name: data.name,
      whatsappIds,
      messagesPerHour,
      minDelay,
      maxDelay
    });
  } catch (err) {
    throw new AppError(err.message);
  }

  // Validate that we have either message or media
  if (!data.message && (!files || files.length === 0)) {
    throw new AppError("Either message text or media file is required");
  }

  // Make sure the selected connections belong to this company and are online
  const validWhatsapps = await Whatsapp.findAll({
    where: { id: whatsappIds, companyId, status: "CONNECTED" },
    attributes: ["id"]
  });

  if (validWhatsapps.length === 0) {
    throw new AppError("No connected WhatsApp found for the selected ids");
  }

  const validWhatsappIds = validWhatsapps.map(w => w.id);

  // Handle media upload
  let mediaPath = "";
  let mediaName = "";
  if (files && files.length > 0) {
    const file = files[0];
    // Store only the filename, not the full path
    mediaPath = file.filename;
    mediaName = file.filename;
  }

  // Get contacts based on criteria (groups excluded)
  let contacts: Contact[] = [];

  if (sendToAll) {
    contacts = await Contact.findAll({
      where: { companyId, isGroup: false },
      attributes: ["id", "name", "number"]
    });
  } else if (tagIds && tagIds.length > 0) {
    contacts = await Contact.findAll({
      where: { companyId, isGroup: false },
      attributes: ["id", "name", "number"],
      include: [
        {
          model: Tag,
          as: "tags",
          attributes: [],
          through: { attributes: [] },
          where: { id: tagIds },
          required: true
        }
      ]
    });
  }

  if (contacts.length === 0) {
    throw new AppError("No contacts found for the specified criteria");
  }

  // Create bulk campaign
  const campaign = await BulkCampaign.create({
    name: data.name,
    message: data.message || "",
    sendToAll,
    whatsappIds: validWhatsappIds,
    tagIds: tagIds || [],
    messagesPerHour,
    minDelay,
    maxDelay,
    companyId,
    mediaPath,
    mediaName,
    totalContacts: contacts.length,
    status: "PENDING"
  } as any);

  // Create bulk messages for each contact
  const bulkMessages = [];
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const whatsappId = validWhatsappIds[i % validWhatsappIds.length]; // Load balancing

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
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-bulk-campaign`,
    {
      action: "create",
      campaign
    }
  );

  return res.status(201).json(campaign);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
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
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-bulk-campaign`,
    {
      action: "update",
      campaign
    }
  );

  return res.json(campaign);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
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
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-bulk-campaign`,
    {
      action: "delete",
      campaignId: id
    }
  );

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
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-bulk-campaign`,
    {
      action: "update",
      campaign
    }
  );

  return res.json({ message: "Campaign paused successfully" });
};

export const resume = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  const campaign = await BulkCampaign.findOne({
    where: { id, companyId }
  });

  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  if (
    campaign.status !== "PAUSED" &&
    campaign.status !== "PENDING" &&
    campaign.status !== "CANCELLED"
  ) {
    throw new AppError(
      "Can only resume paused, pending or cancelled campaigns",
      400
    );
  }

  const wasCancelled = campaign.status === "CANCELLED";

  await campaign.update({
    status: "RUNNING",
    ...(wasCancelled ? { completedAt: null as any } : {})
  });

  // Resume processing the campaign
  BulkMessageService.processCampaign(campaign.id);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-bulk-campaign`,
    {
      action: "update",
      campaign
    }
  );

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

  // PENDING BulkMessages are intentionally left intact so that a future
  // resume of a cancelled campaign can pick them up and finish dispatching.

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-bulk-campaign`,
    {
      action: "update",
      campaign
    }
  );

  return res.json({ message: "Campaign stopped successfully" });
};

export const getActive = async (
  req: Request,
  res: Response
): Promise<Response> => {
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

export const getAll = async (
  req: Request,
  res: Response
): Promise<Response> => {
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

export const getDetails = async (
  req: Request,
  res: Response
): Promise<Response> => {
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
