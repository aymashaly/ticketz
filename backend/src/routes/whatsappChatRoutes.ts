import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";
import * as WhatsAppChatController from "../controllers/WhatsAppChatController";

const whatsappChatRoutes = Router();
const upload = multer(uploadConfig);

// Get all contacts with their latest messages (WhatsApp Web style)
whatsappChatRoutes.get("/whatsapp-chats", isAuth, WhatsAppChatController.index);

// Get messages for a specific contact
whatsappChatRoutes.get("/whatsapp-chats/:contactId/messages", isAuth, WhatsAppChatController.getMessages);

// Send message to a contact
whatsappChatRoutes.post(
  "/whatsapp-chats/:contactId/messages", 
  isAuth, 
  upload.array("medias"),
  WhatsAppChatController.sendMessage
);

export default whatsappChatRoutes;