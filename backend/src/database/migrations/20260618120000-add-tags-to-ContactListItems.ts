import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("ContactListItems", "tags", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: ""
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("ContactListItems", "tags");
  }
};
