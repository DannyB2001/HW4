const { MongoClient, ObjectId } = require("mongodb");

const COLLECTIONS = {
  SHOPPING_LIST: "shoppingList",
  ITEM: "item",
  MEMBERSHIP: "membership"
};

const AWID = process.env.AWID || null;

let client;
let db;

const connectToDb = async () => {
  if (db) return db;
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/shopping-list";
  client = new MongoClient(uri);
  await client.connect();
  db = client.db();

  // Create helpful indexes for lookups
  await Promise.all([
    db.collection(COLLECTIONS.MEMBERSHIP).createIndex({ shoppingListId: 1 }),
    db.collection(COLLECTIONS.ITEM).createIndex({ shoppingListId: 1 }),
    db.collection(COLLECTIONS.ITEM).createIndex({ shoppingListId: 1, isDone: 1 })
  ]);

  return db;
};

const getCollection = (name) => {
  if (!db) {
    throw new Error("Database not initialized. Call connectToDb() first.");
  }
  return db.collection(name);
};

const toObjectId = (id) => {
  try {
    return new ObjectId(id);
  } catch (e) {
    return null;
  }
};

const mapShoppingList = (doc) =>
  doc && {
    shoppingListId: doc._id.toString(),
    awid: doc.awid ?? null,
    name: doc.name,
    description: doc.description || "",
    state: doc.state || "active",
    canMarkItemsDoneByAll: Boolean(doc.canMarkItemsDoneByAll),
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };

const mapMembership = (doc) =>
  doc && {
    membershipId: doc._id.toString(),
    awid: doc.awid ?? null,
    shoppingListId: doc.shoppingListId.toString(),
    memberId: doc.userId,
    role: doc.role,
    createdAt: doc.createdAt,
    createdBy: doc.createdBy
  };

const mapItem = (doc) =>
  doc && {
    itemId: doc._id.toString(),
    awid: doc.awid ?? null,
    shoppingListId: doc.shoppingListId.toString(),
    name: doc.text ?? doc.name,
    quantity: doc.amount ?? doc.quantity ?? "",
    note: doc.note ?? "",
    unit: doc.unit,
    done: doc.isDone ?? doc.done ?? false,
    createdBy: doc.createdBy,
    doneBy: doc.doneBy,
    doneAt: doc.doneAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };

// shoppingList helpers -------------------------------------------------------
const createShoppingList = async ({
  name,
  description = "",
  canMarkItemsDoneByAll = false,
  ownerId
}) => {
  const now = new Date().toISOString();
  const shoppingListDoc = {
    awid: AWID,
    name,
    description,
    state: "active",
    canMarkItemsDoneByAll: Boolean(canMarkItemsDoneByAll),
    createdBy: ownerId,
    createdAt: now,
    updatedAt: now
  };
  const shoppingListCol = getCollection(COLLECTIONS.SHOPPING_LIST);
  const membershipCol = getCollection(COLLECTIONS.MEMBERSHIP);
  const insertResult = await shoppingListCol.insertOne(shoppingListDoc);
  const shoppingListId = insertResult.insertedId;
  await membershipCol.insertOne({
    awid: AWID,
    shoppingListId,
    userId: ownerId,
    role: "owner",
    createdBy: ownerId,
    createdAt: now
  });
  return mapShoppingList({ _id: shoppingListId, ...shoppingListDoc });
};

const getShoppingList = async (shoppingListId) => {
  const _id = toObjectId(shoppingListId);
  if (!_id) return null;
  const shoppingListCol = getCollection(COLLECTIONS.SHOPPING_LIST);
  const doc = await shoppingListCol.findOne({ _id });
  return mapShoppingList(doc);
};

const updateShoppingList = async (shoppingListId, patch) => {
  const _id = toObjectId(shoppingListId);
  if (!_id) return null;
  const shoppingListCol = getCollection(COLLECTIONS.SHOPPING_LIST);
  const filteredPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  );
  const update = { ...filteredPatch, updatedAt: new Date().toISOString() };
  const result = await shoppingListCol.findOneAndUpdate(
    { _id },
    { $set: update },
    { returnDocument: "after" }
  );
  return result.value ? mapShoppingList(result.value) : null;
};

const deleteShoppingList = async (shoppingListId) => {
  const _id = toObjectId(shoppingListId);
  if (!_id) return false;
  const shoppingListCol = getCollection(COLLECTIONS.SHOPPING_LIST);
  const membershipCol = getCollection(COLLECTIONS.MEMBERSHIP);
  const itemCol = getCollection(COLLECTIONS.ITEM);
  await membershipCol.deleteMany({ shoppingListId: _id });
  await itemCol.deleteMany({ shoppingListId: _id });
  const result = await shoppingListCol.deleteOne({ _id });
  return result.deletedCount > 0;
};

const listShoppingListsByUser = async (userId, state) => {
  const membershipCol = getCollection(COLLECTIONS.MEMBERSHIP);
  const shoppingListCol = getCollection(COLLECTIONS.SHOPPING_LIST);
  const memberships = await membershipCol.find({ userId }).toArray();
  const shoppingListIds = memberships.map((m) => m.shoppingListId);
  if (!shoppingListIds.length) return [];
  const query = { _id: { $in: shoppingListIds } };
  if (state) query.state = state;
  const lists = await shoppingListCol.find(query).toArray();
  return lists.map(mapShoppingList);
};

// membership helpers ---------------------------------------------------------
const findMembership = async (shoppingListId, memberId) => {
  const _id = toObjectId(shoppingListId);
  if (!_id) return null;
  const membershipCol = getCollection(COLLECTIONS.MEMBERSHIP);
  const membership = await membershipCol.findOne({ shoppingListId: _id, userId: memberId });
  return mapMembership(membership);
};

const addMembership = async ({ shoppingListId, memberId, role = "member", createdBy }) => {
  const _id = toObjectId(shoppingListId);
  if (!_id) return { membership: null, alreadyExisted: false };
  const membershipCol = getCollection(COLLECTIONS.MEMBERSHIP);
  const existing = await membershipCol.findOne({ shoppingListId: _id, userId: memberId });
  if (existing) return { membership: mapMembership(existing), alreadyExisted: true };
  const now = new Date().toISOString();
  const result = await membershipCol.insertOne({
    awid: AWID,
    shoppingListId: _id,
    userId: memberId,
    role,
    createdBy,
    createdAt: now
  });
  const membership = await membershipCol.findOne({ _id: result.insertedId });
  return { membership: mapMembership(membership), alreadyExisted: false };
};

const removeMembership = async (shoppingListId, memberId) => {
  const _id = toObjectId(shoppingListId);
  if (!_id) return false;
  const membershipCol = getCollection(COLLECTIONS.MEMBERSHIP);
  const result = await membershipCol.deleteOne({ shoppingListId: _id, userId: memberId });
  return result.deletedCount > 0;
};

const listMembers = async (shoppingListId) => {
  const _id = toObjectId(shoppingListId);
  if (!_id) return [];
  const membershipCol = getCollection(COLLECTIONS.MEMBERSHIP);
  const memberships = await membershipCol.find({ shoppingListId: _id }).toArray();
  return memberships.map(mapMembership);
};

// item helpers ---------------------------------------------------------------
const createItem = async ({ shoppingListId, name, quantity = "", note = "", createdBy }) => {
  const _id = toObjectId(shoppingListId);
  if (!_id) return null;
  const now = new Date().toISOString();
  const itemDoc = {
    awid: AWID,
    shoppingListId: _id,
    text: name,
    name,
    note,
    amount: quantity,
    isDone: false,
    createdBy,
    doneBy: null,
    doneAt: null,
    createdAt: now,
    updatedAt: now
  };
  const itemCol = getCollection(COLLECTIONS.ITEM);
  const result = await itemCol.insertOne(itemDoc);
  return mapItem({ _id: result.insertedId, ...itemDoc });
};

const getItem = async (itemId) => {
  const _id = toObjectId(itemId);
  if (!_id) return null;
  const itemCol = getCollection(COLLECTIONS.ITEM);
  const item = await itemCol.findOne({ _id });
  return mapItem(item);
};

const updateItem = async (itemId, patch) => {
  const _id = toObjectId(itemId);
  if (!_id) return null;
  const itemCol = getCollection(COLLECTIONS.ITEM);
  const filteredPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  );
  const update = { ...filteredPatch, updatedAt: new Date().toISOString() };
  const result = await itemCol.findOneAndUpdate(
    { _id },
    { $set: update },
    { returnDocument: "after" }
  );
  return result.value ? mapItem(result.value) : null;
};

const deleteItem = async (itemId) => {
  const _id = toObjectId(itemId);
  if (!_id) return false;
  const itemCol = getCollection(COLLECTIONS.ITEM);
  const result = await itemCol.deleteOne({ _id });
  return result.deletedCount > 0;
};

const listItems = async (shoppingListId, done) => {
  const _id = toObjectId(shoppingListId);
  if (!_id) return [];
  const itemCol = getCollection(COLLECTIONS.ITEM);
  const query = { shoppingListId: _id };
  if (done !== undefined) query.isDone = done;
  const items = await itemCol.find(query).toArray();
  return items.map(mapItem);
};

module.exports = {
  connectToDb,
  createShoppingList,
  getShoppingList,
  updateShoppingList,
  deleteShoppingList,
  listShoppingListsByUser,
  findMembership,
  addMembership,
  removeMembership,
  listMembers,
  createItem,
  getItem,
  updateItem,
  deleteItem,
  listItems
};
