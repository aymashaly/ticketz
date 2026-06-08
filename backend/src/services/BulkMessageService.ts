import BulkCampaign from "../models/BulkCampaign";
import BulkMessage from "../models/BulkMessage";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
import { getWbot } from "../libs/wbot";
import { getIO } from "../libs/socket";
import { logger } from "../utils/logger";
import { getMessageFileOptions } from "./WbotServices/SendWhatsAppMedia";
import path from "path";

class BulkMessageService {
  private static processingCampaigns = new Set<number>();

  public static async processCampaign(campaignId: number): Promise<void> {
    if (this.processingCampaigns.has(campaignId)) {
      logger.info(`Campaign ${campaignId} is already being processed`);
      return;
    }

    this.processingCampaigns.add(campaignId);
    logger.info(`Starting to process campaign ${campaignId}`);

    try {
      const campaign = await BulkCampaign.findByPk(campaignId);
      if (!campaign) {
        logger.error(`Campaign ${campaignId} not found`);
        return;
      }

      logger.info(`Campaign ${campaignId} found: ${campaign.name}`);

      await campaign.update({ 
        status: "RUNNING",
        startedAt: new Date()
      });

      const messages = await BulkMessage.findAll({
        where: { 
          bulkCampaignId: campaignId,
          status: "PENDING"
        },
        include: [
          { model: Contact, as: "contact" },
          { model: Whatsapp, as: "whatsapp" }
        ],
        order: [["id", "ASC"]]
      });

      logger.info(`Found ${messages.length} messages to send for campaign ${campaignId}`);

      if (messages.length === 0) {
        await campaign.update({ 
          status: "COMPLETED",
          completedAt: new Date()
        });
        logger.info(`Campaign ${campaignId} completed - no messages to send`);
        return;
      }

      // Calculate delay between messages based on messages per hour
      const baseDelayMs = (60 * 60 * 1000) / campaign.messagesPerHour;
      logger.info(`Base delay for campaign ${campaignId}: ${baseDelayMs}ms`);
      
      for (const message of messages) {
        // Check if campaign was cancelled or paused
        await campaign.reload();
        if (campaign.status === "CANCELLED") {
          logger.info(`Campaign ${campaignId} was cancelled, stopping processing`);
          break;
        }
        if (campaign.status === "PAUSED") {
          logger.info(`Campaign ${campaignId} was paused, stopping processing`);
          break;
        }

        try {
          logger.info(`Sending message ${message.id} to contact ${message.contact?.name} (${message.contact?.number})`);
          await this.sendMessage(message, campaign);
          
          // Update campaign counters
          await campaign.increment("sentCount");
          await campaign.reload(); // Reload to get updated count
          logger.info(`Message ${message.id} sent successfully`);
          
          // Emit real-time update to frontend
          const io = getIO();
          io.to(`company-${campaign.companyId}-mainchannel`).emit(
            `company-${campaign.companyId}-bulk-campaign`,
            {
              action: "message-sent",
              campaignId: campaign.id,
              messageId: message.id,
              contact: message.contact,
              sentCount: campaign.sentCount
            }
          );
          
          // Random delay between messages
          const randomDelay = this.getRandomDelay(
            campaign.minDelay * 1000,
            campaign.maxDelay * 1000
          );
          
          const totalDelay = Math.max(baseDelayMs, randomDelay);
          
          if (messages.indexOf(message) < messages.length - 1) {
            logger.info(`Waiting ${totalDelay}ms before next message`);
            await this.sleep(totalDelay);
          }
          
        } catch (error: any) {
          logger.error({ message: error?.message }, `Error sending bulk message ${message.id}`);
          await message.update({
            status: "FAILED",
            errorMessage: error?.message || "Unknown error"
          });
          await campaign.increment("failedCount");
          await campaign.reload(); // Reload to get updated count
          
          // Emit error update to frontend
          const io = getIO();
          io.to(`company-${campaign.companyId}-mainchannel`).emit(
            `company-${campaign.companyId}-bulk-campaign`,
            {
              action: "message-failed",
              campaignId: campaign.id,
              messageId: message.id,
              contact: message.contact,
              error: error?.message,
              failedCount: campaign.failedCount
            }
          );
        }
      }

      // Check if campaign is completed
      const pendingCount = await BulkMessage.count({
        where: { 
          bulkCampaignId: campaignId,
          status: "PENDING"
        }
      });

      if (pendingCount === 0) {
        await campaign.update({ 
          status: "COMPLETED",
          completedAt: new Date()
        });
        logger.info(`Campaign ${campaignId} completed successfully`);
      }

      // Emit update to frontend
      const io = getIO();
      io.to(`company-${campaign.companyId}-mainchannel`).emit(
        `company-${campaign.companyId}-bulk-campaign`,
        {
          action: "update",
          campaign: await campaign.reload()
        }
      );

    } catch (error: any) {
      logger.error({ message: error?.message }, `Error processing campaign ${campaignId}`);
    } finally {
      this.processingCampaigns.delete(campaignId);
      logger.info(`Finished processing campaign ${campaignId}`);
    }
  }

  private static async sendMessage(
    bulkMessage: BulkMessage, 
    campaign: BulkCampaign
  ): Promise<void> {
    const { contact, whatsapp } = bulkMessage;
    
    if (!contact || !whatsapp) {
      throw new Error("Contact or WhatsApp connection not found");
    }

    if (whatsapp.status !== "CONNECTED") {
      throw new Error(`WhatsApp ${whatsapp.name} is not connected`);
    }

    const wbot = getWbot(whatsapp.id);
    const contactNumber = contact.number.replace(/\D/g, "");
    const chatId = `${contactNumber}@c.us`;

    let messageText = bulkMessage.message;

    try {
      let sentMessage;

      if (messageText) {
        // Send text message first
        sentMessage = await wbot.sendMessage(chatId, {
          text: messageText
        });
      }

      if (bulkMessage.mediaPath) {
        // Send media - mediaPath is just the filename
        const filePath = path.resolve("public", bulkMessage.mediaPath);
        
        // Check if file exists
        const fs = require('fs');
        if (!fs.existsSync(filePath)) {
          throw new Error(`Media file not found: ${filePath}`);
        }
        
        const mediaContent = await getMessageFileOptions(
          bulkMessage.mediaPath.split('/').pop() || "media",
          filePath
        );
        
        if (mediaContent && Object.keys(mediaContent).length > 0) {
          const mediaMessage = await wbot.sendMessage(chatId, mediaContent);
          if (!sentMessage) {
            sentMessage = mediaMessage;
          }
        }
      }

      if (!sentMessage) {
        throw new Error("No message content to send");
      }

      await bulkMessage.update({
        status: "SENT",
        sentAt: new Date(),
        messageId: sentMessage.key.id
      });

      logger.info(`Bulk message sent to ${contact.name} (${contact.number})`);

    } catch (error: any) {
      logger.error({ message: error?.message }, `Failed to send bulk message to ${contact.number}`);
      throw error;
    }
  }

  private static getRandomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public static async resumeAllCampaigns(): Promise<void> {
    const runningCampaigns = await BulkCampaign.findAll({
      where: { status: "RUNNING" }
    });

    for (const campaign of runningCampaigns) {
      this.processCampaign(campaign.id);
    }
  }
}

export default BulkMessageService;