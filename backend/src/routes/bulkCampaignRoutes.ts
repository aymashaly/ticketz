import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";
import * as BulkCampaignController from "../controllers/BulkCampaignController";

const upload = multer(uploadConfig);
const routes = express.Router();

routes.get("/bulk-campaigns", isAuth, BulkCampaignController.index);
routes.get("/bulk-campaigns/active", isAuth, BulkCampaignController.getActive);
routes.get("/bulk-campaigns/all", isAuth, BulkCampaignController.getAll);
routes.get("/bulk-campaigns/:id", isAuth, BulkCampaignController.show);
routes.get("/bulk-campaigns/:id/details", isAuth, BulkCampaignController.getDetails);

routes.post(
  "/bulk-campaigns", 
  isAuth, 
  upload.array("media"), 
  BulkCampaignController.store
);

routes.put("/bulk-campaigns/:id", isAuth, BulkCampaignController.update);
routes.delete("/bulk-campaigns/:id", isAuth, BulkCampaignController.remove);
routes.post("/bulk-campaigns/:id/stop", isAuth, BulkCampaignController.stop);
routes.post("/bulk-campaigns/:id/pause", isAuth, BulkCampaignController.pause);
routes.post("/bulk-campaigns/:id/resume", isAuth, BulkCampaignController.resume);

export default routes;