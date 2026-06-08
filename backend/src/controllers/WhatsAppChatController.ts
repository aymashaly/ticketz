import { Request, Response } from "express";
import { Op, QueryTypes } from "sequelize";
import Contact from "../models/Contact";
import Message from "../models/Message";
import Whatsapp from "../models/Whatsapp";
import Ticket from "../models/Ticket";
import AppError from "../errors/AppError";
import sequelize from "../database";

interface ChatQuery {
  searchParam?: string;
  pageNumber?: string;
}

interface MessageQuery {
  pageNumber?: string;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { searchParam = "", pageNumber = "1" } = req.query as ChatQuery;

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  // Get contacts that have messages (actual conversations)
  let whereCondition = `
    WHERE c."companyId" = :companyId 
    AND EXISTS (
      SELECT 1 FROM "Messages" m 
      WHERE m."contactId" = c.id 
      AND m."companyId" = :companyId
    )
  `;

  const replacements: any = { companyId };

  if (searchParam) {
    whereCondition += ` AND (c.name ILIKE :searchParam OR c.number ILIKE :searchParam)`;
    replacements.searchParam = `%${searchParam}%`;
  }

  // Get contacts with their latest message and unread count
  const query = `
    SELECT 
      c.id,
      c.name,
      c.number,
      c."profilePicUrl",
      c."isGroup",
      c.presence,
      c."updatedAt",
      (
        SELECT json_build_object(
          'id', m.id,
          'body', m.body,
          'fromMe', m."fromMe",
          'createdAt', m."createdAt",
          'mediaType', m."mediaType",
          'ack', m.ack,
          'read', m.read
        )
        FROM "Messages" m 
        WHERE m."contactId" = c.id 
        ORDER BY m."createdAt" DESC 
        LIMIT 1
      ) as "lastMessage",
      (
        SELECT COUNT(*)::int
        FROM "Messages" m 
        WHERE m."contactId" = c.id 
        AND m."fromMe" = false 
        AND m.read = false
      ) as "unreadCount"
    FROM "Contacts" c
    ${whereCondition}
    ORDER BY (
      SELECT m."createdAt"
      FROM "Messages" m 
      WHERE m."contactId" = c.id 
      ORDER BY m."createdAt" DESC 
      LIMIT 1
    ) DESC NULLS LAST
    LIMIT :limit OFFSET :offset
  `;

  const contacts = await sequelize.query(query, {
    replacements: { ...replacements, limit, offset },
    type: QueryTypes.SELECT
  });

  // Get total count
  const countQuery = `
    SELECT COUNT(*)::int as count
    FROM "Contacts" c
    ${whereCondition}
  `;

  const [{ count }] = await sequelize.query(countQuery, {
    replacements,
    type: QueryTypes.SELECT
  }) as [{ count: number }];

  const hasMore = count > offset + contacts.length;

  return res.json({
    contacts,
    count,
    hasMore
  });
};

export const getMessages = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;
  const { pageNumber = "1" } = req.query as MessageQuery;

  const limit = 50;
  const offset = limit * (+pageNumber - 1);

  // Verify contact belongs to company
  const contact = await Contact.findOne({
    where: { id: parseInt(contactId), companyId }
  });

  if (!contact) {
    throw new AppError("Contact not found", 404);
  }

  // Get messages for this contact
  const { count, rows: messages } = await Message.findAndCountAll({
    where: { 
      contactId: parseInt(contactId),
      companyId,
      mediaType: {
        [Op.or]: {
          [Op.ne]: "reactionMessage",
          [Op.is]: null
        }
      }
    },
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Message,
        as: "quotedMsg",
        required: false,
        include: ["contact"]
      },
      {
        model: Contact,
        as: "contact"
      }
    ]
  });

  // Mark messages as read
  await Message.update(
    { read: true },
    {
      where: {
        contactId: parseInt(contactId),
        companyId,
        fromMe: false,
        read: false
      }
    }
  );

  const hasMore = count > offset + messages.length;

  return res.json({
    messages: messages.reverse(), // Reverse to show oldest first
    count,
    hasMore,
    contact: {
      id: contact.id,
      name: contact.name,
      number: contact.number,
      profilePicUrl: contact.profilePicUrl,
      isGroup: contact.isGroup,
      presence: contact.presence
    }
  });
};

export const sendMessage = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;
  const { message, quotedMsgId } = req.body;
  const medias = req.files as Express.Multer.File[];

  // Verify contact belongs to company
  const contact = await Contact.findOne({
    where: { id: parseInt(contactId), companyId }
  });

  if (!contact) {
    throw new AppError("Contact not found", 404);
  }

  // Get the first available WhatsApp connection for this company
  const whatsapp = await Whatsapp.findOne({
    where: { 
      companyId,
      status: "CONNECTED"
    }
  });

  if (!whatsapp) {
    throw new AppError("No WhatsApp connection available", 400);
  }

  // Find or create a ticket for this contact
  let ticket = await Ticket.findOne({
    where: {
      contactId: parseInt(contactId),
      companyId,
      whatsappId: whatsapp.id,
      status: { [Op.in]: ["open", "pending"] }
    }
  });

  if (!ticket) {
    // Create a new ticket for this conversation
    ticket = await Ticket.create({
      contactId: parseInt(contactId),
      companyId,
      whatsappId: whatsapp.id,
      status: "open",
      isGroup: contact.isGroup,
      unreadMessages: 0,
      lastMessage: message || "Media"
    });
  }

  try {
    // Import the existing message sending services
    const SendWhatsAppMessage = require("../services/WbotServices/SendWhatsAppMessage").default;
    const SendWhatsAppMedia = require("../services/WbotServices/SendWhatsAppMedia").default;

    if (medias && medias.length > 0) {
      // Send media files
      for (const media of medias) {
        await SendWhatsAppMedia({ media, ticket });
      }
    }

    if (message && message.trim()) {
      // Send text message
      await SendWhatsAppMessage({ 
        body: message, 
        ticket,
        quotedMsg: quotedMsgId 
      });
    }

    return res.json({ 
      success: true, 
      message: "Message sent successfully"
    });
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    throw new AppError("Failed to send message", 500);
  }
};