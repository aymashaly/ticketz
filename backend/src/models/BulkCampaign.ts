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
  HasMany,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import BulkMessage from "./BulkMessage";

@Table({ tableName: "BulkCampaigns" })
class BulkCampaign extends Model<BulkCampaign> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column(DataType.TEXT)
  message: string;

  @Column
  mediaPath: string;

  @Column
  mediaName: string;

  @Column(DataType.JSON)
  whatsappIds: number[];

  @Column(DataType.JSON)
  tagIds: number[];

  @Column({ defaultValue: false })
  sendToAll: boolean;

  @Column({ defaultValue: "PENDING" })
  status: string; // PENDING, RUNNING, PAUSED, COMPLETED, CANCELLED

  @Column({ defaultValue: 30 })
  messagesPerHour: number;

  @Column({ defaultValue: 5 })
  minDelay: number;

  @Column({ defaultValue: 15 })
  maxDelay: number;

  @Column({ defaultValue: true })
  randomizeMessage: boolean;

  @Column({ defaultValue: 0 })
  totalContacts: number;

  @Column({ defaultValue: 0 })
  sentCount: number;

  @Column({ defaultValue: 0 })
  deliveredCount: number;

  @Column({ defaultValue: 0 })
  failedCount: number;

  @Column
  scheduledAt: Date;

  @Column
  startedAt: Date;

  @Column
  completedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => BulkMessage)
  messages: BulkMessage[];
}

export default BulkCampaign;