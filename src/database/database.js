const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const config = require('../config.js');
const { StatusCodeError } = require('../endpointHelper.js');
const { Role } = require('../model/model.js');
const dbModel = require('./dbModel.js');
const logging = require('../logging.js');

// TODO: make modular - easy to switch to a dummy DB for testing
// TODO: consider adding a deleteDB function for testing purposes

class DB {
  constructor() {
    this.initialized = this.initializeDatabase();
  }

  async getMenu() {
    const connection = await this.getConnection();
    try {
      const rows = await this.query(connection, `SELECT * FROM menu`);
      return rows;
    } finally {
      connection.end();
    }
  }

  async getMenuItem(menuId) {
    const connection = await this.getConnection();
    try {
      const rows = await this.query(connection, `SELECT * FROM menu WHERE id=?`, [menuId]);
      return rows[0];
    } finally {
      connection.end();
    }
  }


  async addMenuItem(item) {
    const connection = await this.getConnection();
    try {
      const addResult = await this.query(connection, `INSERT INTO menu (title, description, image, price) VALUES (?, ?, ?, ?)`, [item.title, item.description, item.image, item.price]);
      return { ...item, id: addResult.insertId };
    } finally {
      connection.end();
    }
  }

  async addUser(user) {
    const connection = await this.getConnection();
    try {
      const hashedPassword = await bcrypt.hash(user.password, 10);

      const userResult = await this.query(connection, `INSERT INTO user (name, email, password) VALUES (?, ?, ?)`, [user.name, user.email, hashedPassword]);
      const userId = userResult.insertId;
      for (const role of user.roles) {
        switch (role.role) {
          case Role.Franchisee: {
            const franchiseId = await this.getID(connection, 'name', role.object, 'franchise');
            await this.query(connection, `INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`, [userId, role.role, franchiseId]);
            break;
          }
          default: {
            await this.query(connection, `INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`, [userId, role.role, 0]);
            break;
          }
        }
      }
      return { ...user, id: userId, password: undefined };
    } finally {
      connection.end();
    }
  }

  async getUser(email, password) {
    const connection = await this.getConnection();
    try {
      const userResult = await this.query(connection, `SELECT * FROM user WHERE email=?`, [email]);
      const user = userResult[0];
      if (!user) {
        throw new StatusCodeError('unknown user', 404);
      } else if (password && !(await bcrypt.compare(password, user.password))) {
        throw new StatusCodeError('password incorrect', 401);
      } else if (user.password === null) {
        throw new StatusCodeError('password is required', 401);
      } else if (user.password === undefined) {
        throw new StatusCodeError('password is required', 401);
      }

      const roleResult = await this.query(connection, `SELECT * FROM userRole WHERE userId=?`, [user.id]);
      const roles = roleResult.map((r) => {
        return { objectId: r.objectId || undefined, role: r.role };
      });

      return { ...user, roles: roles, password: undefined };
    } finally {
      connection.end();
    }
  }

  async getUserByToken(token){
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(`SELECT userId FROM auth WHERE token = ?`, [token]);
      return rows[0].userId;
    } finally {
      connection.end();
    }
  }

  async getAllUsers(authUser, page = 0, limit = 10, nameFilter = '*') {
    const connection = await this.getConnection();

    page = Number(page) || 0;
    limit = Number(limit) || 10;
    if (limit < 1) limit = 1;
    if (limit > 100) limit = 100;
    const offset = page * limit;
    nameFilter = nameFilter.replace(/\*/g, '%');

    try {
      let users = await this.query(connection, `SELECT name, email, id FROM user WHERE name LIKE ? LIMIT ? OFFSET ?`, [
        nameFilter,
        limit + 1,
        offset,
      ]);

      const more = users.length > limit;
      if (more) {
        users = users.slice(0, limit);
      }

      for (const user of users) {
        user.roles = await this.query(connection, `SELECT role FROM userRole WHERE userId=?`, [user.id]);
      }
      return [users, more];
    } finally {
      connection.end();
    }
  }

  async updateUser(userId, name, email, password) {
    const connection = await this.getConnection();
    try {
      userId = Number(userId);
      if (!Number.isInteger(userId) || userId < 1) {
        throw new StatusCodeError('invalid user id', 400);
      }

      const setParts = [];
      const values = [];
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        setParts.push(`password=?`);
        values.push(hashedPassword);
      }
      if (email !== undefined) {
        setParts.push(`email=?`);
        values.push(email);
      }
      if (name) {
        setParts.push(`name=?`);
        values.push(name);
      }
      if (setParts.length > 0) {
        const query = `UPDATE user SET ${setParts.join(', ')} WHERE id=?`;
        await this.query(connection, query, [...values, userId]);
      }
      return this.getUser(email, password);
    } finally {
      connection.end();
    }
  }

  async loginUser(userId, token) {
    token = this.getTokenSignature(token);
    const connection = await this.getConnection();
    try {
      await this.query(connection, `INSERT INTO auth (token, userId) VALUES (?, ?) ON DUPLICATE KEY UPDATE token=token`, [token, userId]);
    } finally {
      connection.end();
    }
  }

  async isLoggedIn(token) {
    token = this.getTokenSignature(token);
    const connection = await this.getConnection();
    try {
      const authResult = await this.query(connection, `SELECT userId FROM auth WHERE token=?`, [token]);
      return authResult.length > 0;
    } finally {
      connection.end();
    }
  }

  async logoutUser(token) {
    token = this.getTokenSignature(token);
    const connection = await this.getConnection();
    try {
      await this.query(connection, `DELETE FROM auth WHERE token=?`, [token]);
    } finally {
      connection.end();
    }
  }

  async getOrders(user, page = 1) {
    const connection = await this.getConnection();
    try {
      const offset = this.getOffset(page, config.db.listPerPage);
      const orders = await this.query(connection, `SELECT id, franchiseId, storeId, date FROM dinerOrder WHERE dinerId=? LIMIT ?,?`, [
        user.id,
        Number(offset) || 0,
        Number(config.db.listPerPage) || 10,
      ]);
      for (const order of orders) {
        let items = await this.query(connection, `SELECT id, menuId, description, price FROM orderItem WHERE orderId=?`, [order.id]);
        order.items = items;
      }
      return { dinerId: user.id, orders: orders, page };
    } finally {
      connection.end();
    }
  }

  async addDinerOrder(user, order) {
    const connection = await this.getConnection();
    try {
      const orderResult = await this.query(connection, `INSERT INTO dinerOrder (dinerId, franchiseId, storeId, date) VALUES (?, ?, ?, now())`, [user.id, order.franchiseId, order.storeId]);
      const orderId = orderResult.insertId;
      const sanitizedItems = [];
      for (const item of order.items || []) {
        const menuRow = await this.getMenuItem(item.menuId);
        if (!menuRow) {
          throw new StatusCodeError('unknown menu item', 404);
        }
        const menuId = menuRow.id;
        const price = Number(menuRow.price);
        const description = menuRow.description;
        await this.query(connection, `INSERT INTO orderItem (orderId, menuId, description, price) VALUES (?, ?, ?, ?)`, [orderId, menuId, description, price]);
        sanitizedItems.push({ menuId, description, price });
      }
      return {
        franchiseId: order.franchiseId,
        storeId: order.storeId,
        id: orderId,
        items: sanitizedItems,
      };
    } finally {
      connection.end();
    }
  }

  async createFranchise(franchise) {
    const connection = await this.getConnection();
    try {
      for (const admin of franchise.admins) {
        const adminUser = await this.query(connection, `SELECT id, name FROM user WHERE email=?`, [admin.email]);
        if (adminUser.length == 0) {
          throw new StatusCodeError(`unknown user for franchise admin ${admin.email} provided`, 404);
        }
        admin.id = adminUser[0].id;
        admin.name = adminUser[0].name;
      }

      const franchiseResult = await this.query(connection, `INSERT INTO franchise (name) VALUES (?)`, [franchise.name]);
      franchise.id = franchiseResult.insertId;

      for (const admin of franchise.admins) {
        await this.query(connection, `INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`, [admin.id, Role.Franchisee, franchise.id]);
      }

      return franchise;
    } finally {
      connection.end();
    }
  }

  async deleteFranchise(franchiseId) {
    const id = Number(franchiseId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new StatusCodeError('invalid franchise id', 400);
    }
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();
      try {
        await this.query(connection, `DELETE FROM store WHERE franchiseId=?`, [id]);
        await this.query(connection, `DELETE FROM userRole WHERE objectId=?`, [id]);
        const delResult = await this.query(connection, `DELETE FROM franchise WHERE id=?`, [id]);
        const affectedRows =
          delResult && typeof delResult.affectedRows === 'number' ? delResult.affectedRows : 0;
        if (affectedRows === 0) {
          await connection.rollback();
          throw new StatusCodeError('franchise not found', 404);
        }
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        if (err instanceof StatusCodeError) {
          throw err;
        }
        throw new StatusCodeError('unable to delete franchise', 500);
      }
    } finally {
      connection.end();
    }
  }

  async getFranchises(authUser, page = 0, limit = 10, nameFilter = '*') {
    const connection = await this.getConnection();

    const offset = page * limit;
    nameFilter = nameFilter.replace(/\*/g, '%');

    try {
      let franchises = await this.query(connection, `SELECT id, name FROM franchise WHERE name LIKE ? LIMIT ${limit + 1} OFFSET ${offset}`, [nameFilter]);

      const more = franchises.length > limit;
      if (more) {
        franchises = franchises.slice(0, limit);
      }

      for (const franchise of franchises) {
        if (authUser?.isRole(Role.Admin)) {
          await this.getFranchise(franchise);
        } else {
          franchise.stores = await this.query(connection, `SELECT id, name FROM store WHERE franchiseId=?`, [franchise.id]);
        }
      }
      return [franchises, more];
    } finally {
      connection.end();
    }
  }

  async getUserFranchises(userId) {
    const connection = await this.getConnection();
    try {
      let franchiseIds = await this.query(connection, `SELECT objectId FROM userRole WHERE role='franchisee' AND userId=?`, [userId]);
      if (franchiseIds.length === 0) {
        return [];
      }

      franchiseIds = franchiseIds.map((v) => v.objectId);
      const placeholders = franchiseIds.map(() => '?').join(',');
      const franchises = await this.query(connection, `SELECT id, name FROM franchise WHERE id in (${placeholders})`, franchiseIds);
      for (const franchise of franchises) {
        await this.getFranchise(franchise);
      }
      return franchises;
    } finally {
      connection.end();
    }
  }

  async getFranchise(franchise) {
    const connection = await this.getConnection();
    try {
      franchise.admins = await this.query(connection, `SELECT u.id, u.name, u.email FROM userRole AS ur JOIN user AS u ON u.id=ur.userId WHERE ur.objectId=? AND ur.role='franchisee'`, [franchise.id]);

      franchise.stores = await this.query(connection, `SELECT s.id, s.name, COALESCE(SUM(oi.price), 0) AS totalRevenue FROM dinerOrder AS do JOIN orderItem AS oi ON do.id=oi.orderId RIGHT JOIN store AS s ON s.id=do.storeId WHERE s.franchiseId=? GROUP BY s.id`, [franchise.id]);

      return franchise;
    } finally {
      connection.end();
    }
  }

  async createStore(franchiseId, store) {
    const connection = await this.getConnection();
    try {
      const insertResult = await this.query(connection, `INSERT INTO store (franchiseId, name) VALUES (?, ?)`, [franchiseId, store.name]);
      return { id: insertResult.insertId, franchiseId, name: store.name };
    } finally {
      connection.end();
    }
  }

  async deleteStore(franchiseId, storeId) {
    const connection = await this.getConnection();
    try {
      await this.query(connection, `DELETE FROM store WHERE franchiseId=? AND id=?`, [franchiseId, storeId]);
    } finally {
      connection.end();
    }
  }

  getOffset(currentPage = 1, listPerPage) {
    return (currentPage - 1) * [listPerPage];
  }

  getTokenSignature(token) {
    const parts = token.split('.');
    if (parts.length > 2) {
      return parts[2];
    }
    return '';
  }

  async query(connection, sql, params) {
    const [results] = await connection.execute(sql, params);
    logging.dbLogger(sql, params, results);
    return results;
  }

  async getID(connection, key, value, table) {
    const allowedTables = new Set(['franchise', 'store', 'user', 'menu']);
    const allowedKeys = new Set(['name', 'email', 'id']);
    if (!allowedTables.has(table) || !allowedKeys.has(key)) {
      throw new StatusCodeError('invalid lookup', 500);
    }
    const [rows] = await connection.execute(`SELECT id FROM ${table} WHERE ${key}=?`, [value]);
    if (rows.length > 0) {
      return rows[0].id;
    }
    throw new Error('No ID found');
  }

  async getConnection() {
    // Make sure the database is initialized before trying to get a connection.
    await this.initialized;
    return this._getConnection();
  }

  async _getConnection(setUse = true) {
    const connection = await mysql.createConnection({
      host: config.db.connection.host,
      user: config.db.connection.user,
      password: config.db.connection.password,
      connectTimeout: config.db.connection.connectTimeout,
      decimalNumbers: true,
    });
    if (setUse) {
      await connection.query(`USE ${config.db.connection.database}`);
    }
    return connection;
  }

  async initializeDatabase() {
    try {
      const connection = await this._getConnection(false);
      try {
        const dbExists = await this.checkDatabaseExists(connection);
        console.log(dbExists ? 'Database exists' : 'Database does not exist, creating it');

        await connection.query(`CREATE DATABASE IF NOT EXISTS ${config.db.connection.database}`);
        await connection.query(`USE ${config.db.connection.database}`);

        if (!dbExists) {
          console.log('Successfully created database');
        }

        for (const statement of dbModel.tableCreateStatements) {
          await connection.query(statement);
        }

        if (!dbExists) {
          const defaultAdmin = { name: '常用名字', email: 'a@jwt.com', password: 'admin', roles: [{ role: Role.Admin }] };
          await this.addUser(defaultAdmin);
        }
      } finally {
        connection.end();
      }
    } catch (err) {
      console.error(JSON.stringify({ message: 'Error initializing database', exception: err.message, connection: config.db.connection }));
    }
  }

  async checkDatabaseExists(connection) {
    const [rows] = await connection.execute(`SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`, [config.db.connection.database]);
    return rows.length > 0;
  }

  async getUserIdByToken(token){
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(`SELECT userId FROM auth WHERE token = ?`, [token]);
      return rows[0].userId;
    } finally {
      connection.end();
    }
  }

}

const db = new DB();
module.exports = { Role, DB: db };
