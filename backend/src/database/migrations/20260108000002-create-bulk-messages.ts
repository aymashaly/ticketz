import { QueryInterface, DataTypes } from "sequelize";

export default {
  up: async (queryInterface: QueryInterface) => {
    const tables = (await queryInterface.showAllTables()) as string[];
    if (tables.includes("BulkMessages")) {
      return;
    }

    await queryInterface.createTable("BulkMessages", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      mediaPath: {
        type: DataTypes.STRING,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "PENDING"
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      deliveredAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      messageId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      bulkCampaignId: {
        type: DataTypes.INTEGER,
        references: { model: "BulkCampaigns", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      contactId: {
        type: DataTypes.INTEGER,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("BulkMessages");
  }
};
