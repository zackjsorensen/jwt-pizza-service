const { StatusCodeError } = require('../../endpointHelper.js');

// Minimal in-memory DB mock that satisfies the existing route tests.

const Role = {
  Admin: 'admin',
  Diner: 'diner',
  Franchisee: 'franchisee',
};

let nextUserId = 1;
let nextMenuId = 1;
let nextOrderId = 1;
let nextFranchiseId = 1;
let nextStoreId = 1;

const usersByEmail = new Map();
const usersById = new Map();
const loggedInTokens = new Set();

const menu = [
  { id: nextMenuId++, title: 'Veggie', description: 'A garden of delight', image: 'pizza1.png', price: 0.0038 },
];

const ordersByUserId = new Map(); // userId -> array of orders

const franchises = new Map(); // franchiseId -> {id,name,admins:[{id,name,email}],stores:[]}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeRoles(roles = []) {
  return roles.map((r) => ({ role: r.role, objectId: r.objectId }));
}

const DB = {
  async addUser(user) {
    if (usersByEmail.has(user.email)) {
      throw new StatusCodeError('user already exists', 400);
    }
    const id = nextUserId++;
    const roles = normalizeRoles(user.roles?.length ? user.roles : [{ role: Role.Diner }]);
    const saved = { id, name: user.name, email: user.email, password: user.password, roles };
    usersByEmail.set(saved.email, saved);
    usersById.set(saved.id, saved);
    return { id: saved.id, name: saved.name, email: saved.email, roles: clone(saved.roles), password: undefined };
  },

  async getUser(email, password) {
    const user = usersByEmail.get(email);
    if (!user) throw new StatusCodeError('unknown user', 404);
    if (password && password !== user.password) throw new StatusCodeError('password incorrect', 401);
    return { id: user.id, name: user.name, email: user.email, roles: clone(user.roles), password: undefined };
  },

  async getMenuItem(menuId) {
    return menu.find((m) => m.id === menuId);
  },

  async updateUser(userId, name, email, password) {
    const user = usersById.get(userId);
    if (!user) throw new StatusCodeError('unknown user', 404);
    if (name) user.name = name;
    if (email) {
      // update email index
      usersByEmail.delete(user.email);
      user.email = email;
      usersByEmail.set(user.email, user);
    }
    if (password) user.password = password;
    return { id: user.id, name: user.name, email: user.email, roles: clone(user.roles), password: undefined };
  },

  async getAllUsers(authUser, page = 0, limit = 10, nameFilter = '*') {
    // tests sometimes override this method with jest.fn(); keep this default simple.
    const filter = String(nameFilter).replace(/\*/g, '').toLowerCase();
    const all = [...usersById.values()]
      .filter((u) => (filter ? u.name.toLowerCase().includes(filter) : true))
      .map((u) => ({ id: u.id, name: u.name, email: u.email, roles: clone(u.roles), password: undefined }));
    return [all.slice(page * limit, page * limit + limit), false];
  },

  async loginUser(userId, token) {
    loggedInTokens.add(token);
  },

  async logoutUser(token) {
    loggedInTokens.delete(token);
  },

  async isLoggedIn(token) {
    return loggedInTokens.has(token);
  },

  async getMenu() {
    return clone(menu);
  },

  async addMenuItem(item) {
    menu.push({ id: nextMenuId++, ...item });
  },

  async getOrders(user, page = 0) {
    const list = ordersByUserId.get(user.id) || [];
    return { dinerId: user.id, orders: clone(list), page: Number(page) || 0 };
  },

  async addDinerOrder(user, order) {
    const id = nextOrderId++;
    const sanitizedItems = [];
    for (const item of order.items || []) {
      const menuRow = menu.find((m) => m.id === Number(item.menuId));
      if (!menuRow) {
        throw new StatusCodeError('unknown menu item', 404);
      }
      sanitizedItems.push({
        menuId: menuRow.id,
        description: menuRow.description,
        price: menuRow.price,
      });
    }
    const saved = {
      franchiseId: order.franchiseId,
      storeId: order.storeId,
      id,
      items: sanitizedItems,
    };
    const list = ordersByUserId.get(user.id) || [];
    list.push(clone(saved));
    ordersByUserId.set(user.id, list);
    return clone(saved);
  },

  async getFranchises(_user, page = 0, limit = 10, name = '*') {
    const filter = String(name).replace(/\*/g, '').toLowerCase();
    const all = [...franchises.values()].filter((f) => (filter ? f.name.toLowerCase().includes(filter) : true));
    return [clone(all.slice(page * limit, page * limit + limit)), false];
  },

  async createFranchise(franchise) {
    const id = nextFranchiseId++;
    const admins = (franchise.admins || []).map((a) => {
      const u = usersByEmail.get(a.email);
      if (u) return { id: u.id, name: u.name, email: u.email };
      // allow admin references even if user not present
      return { id: nextUserId++, name: a.email.split('@')[0], email: a.email };
    });
    const f = { id, name: franchise.name, admins, stores: [] };
    franchises.set(id, f);
    return clone(f);
  },

  async deleteFranchise(franchiseId) {
    franchises.delete(franchiseId);
  },

  async getFranchise({ id }) {
    return clone(franchises.get(id));
  },

  async getUserFranchises(userId) {
    const list = [...franchises.values()].filter((f) => f.admins.some((a) => a.id === userId));
    return clone(list);
  },

  async createStore(franchiseId, store) {
    const f = franchises.get(franchiseId);
    if (!f) throw new StatusCodeError('unknown franchise', 404);
    const s = { id: nextStoreId++, franchiseId, name: store.name, location: store.location, totalRevenue: 0 };
    f.stores.push(s);
    return clone(s);
  },

  async deleteStore(franchiseId, storeId) {
    const f = franchises.get(franchiseId);
    if (!f) return;
    f.stores = f.stores.filter((s) => s.id !== storeId);
  },
};

module.exports = { DB, Role };

