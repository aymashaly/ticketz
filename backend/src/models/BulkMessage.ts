import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  DataType
} from "sequelize-typescript";
import BulkCampaign from "./BulkCampaign";
import Contact from "./Contact";
import Whatsapp from "./Whatsapp";

@Table({ tableName: "BulkMessages" })
class BulkMessage extends Model<BulkMessage> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.TEXT)
  message: string;

  @Column
  mediaPath: string;

  @Column({ defaultValue: "PENDING" })
  status: string; // PENDING, SENT, DELIVERED, FAILED

  @Column
  sentAt: Date;

  @Column
  deliveredAt: Date;

  @Column(DataType.TEXT)
  errorMessage: string;

  @Column
  messageId: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => BulkCampaign)
  @Column
  bulkCampaignId: number;

  @BelongsTo(() => BulkCampaign)
  bulkCampaign: BulkCampaign;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;
}

export default BulkMessage;