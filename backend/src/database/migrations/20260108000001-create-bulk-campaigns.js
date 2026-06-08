"use strict";

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable("BulkCampaigns", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      mediaPath: {
        type: Sequelize.STRING,
        allowNull: true
      },
      mediaName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      whatsappIds: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: []
      },
      tagIds: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: []
      },
      sendToAll: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "PENDING"
      },
      messagesPerHour: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30
      },
      minDelay: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5
      },
      maxDelay: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 15
      },
      randomizeMessage: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      totalContacts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      sentCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      deliveredCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      failedCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      scheduledAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      companyId: {
        type: Sequelize.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  down: (queryInterface) => {
    return queryInterface.dropTable("BulkCampaigns");
  }
};