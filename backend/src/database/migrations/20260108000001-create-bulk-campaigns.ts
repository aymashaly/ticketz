import { QueryInterface, DataTypes } from "sequelize";

export default {
  up: async (queryInterface: QueryInterface) => {
    const tables = (await queryInterface.showAllTables()) as string[];
    if (tables.includes("BulkCampaigns")) {
      return;
    }

    await queryInterface.createTable("BulkCampaigns", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
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
      mediaName: {
        type: DataTypes.STRING,
        allowNull: true
      },
      whatsappIds: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: []
      },
      tagIds: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: []
      },
      sendToAll: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "PENDING"
      },
      messagesPerHour: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30
      },
      minDelay: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5
      },
      maxDelay: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 15
      },
      randomizeMessage: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      totalContacts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      sentCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      deliveredCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      failedCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      scheduledAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
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
    return queryInterface.dropTable("BulkCampaigns");
  }
};
