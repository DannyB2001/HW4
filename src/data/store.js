// In-memory úložiště a jednoduché CRUD helpery pro shoppingList, item a membership.
const store = {
  shoppingLists: [],
  items: [],
  memberships: []
};

let seq = 0;
const genId = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${++seq}`;

// shoppingList helpers -------------------------------------------------------
function createShoppingList({ name, description, canMarkItemsDoneByAll = false, ownerId }) {
  const shoppingList = {
    shoppingListId: genId("sl"),
    name,
    description: description || "",
    state: "active",
    canMarkItemsDoneByAll: Boolean(canMarkItemsDoneByAll),
    createdBy: ownerId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.shoppingLists.push(shoppingList);
  // owner membership
  store.memberships.push({
    membershipId: genId("mbr"),
    shoppingListId: shoppingList.shoppingListId,
    memberId: ownerId,
    role: "owner",
    createdAt: new Date().toISOString()
  });
  return shoppingList;
}

function getShoppingList(shoppingListId) {
  return store.shoppingLists.find((sl) => sl.shoppingListId === shoppingListId);
}

function updateShoppingList(shoppingListId, patch) {
  const shoppingList = getShoppingList(shoppingListId);
  if (!shoppingList) return null;
  Object.assign(shoppingList, patch, { updatedAt: new Date().toISOString() });
  return shoppingList;
}

function deleteShoppingList(shoppingListId) {
  store.items = store.items.filter((item) => item.shoppingListId !== shoppingListId);
  store.memberships = store.memberships.filter((m) => m.shoppingListId !== shoppingListId);
  const before = store.shoppingLists.length;
  store.shoppingLists = store.shoppingLists.filter((sl) => sl.shoppingListId !== shoppingListId);
  return store.shoppingLists.length !== before;
}

function listShoppingListsByUser(userId, state) {
  const membershipIds = store.memberships
    .filter((m) => m.memberId === userId)
    .map((m) => m.shoppingListId);
  return store.shoppingLists.filter(
    (sl) => membershipIds.includes(sl.shoppingListId) && (!state || sl.state === state)
  );
}

// membership helpers ---------------------------------------------------------
function findMembership(shoppingListId, memberId) {
  return store.memberships.find(
    (m) => m.shoppingListId === shoppingListId && m.memberId === memberId
  );
}

function addMembership({ shoppingListId, memberId, role = "member" }) {
  const existing = findMembership(shoppingListId, memberId);
  if (existing) return { membership: existing, alreadyExisted: true };
  const membership = {
    membershipId: genId("mbr"),
    shoppingListId,
    memberId,
    role,
    createdAt: new Date().toISOString()
  };
  store.memberships.push(membership);
  return { membership, alreadyExisted: false };
}

function removeMembership(shoppingListId, memberId) {
  const before = store.memberships.length;
  store.memberships = store.memberships.filter(
    (m) => !(m.shoppingListId === shoppingListId && m.memberId === memberId)
  );
  return before !== store.memberships.length;
}

function listMembers(shoppingListId) {
  return store.memberships.filter((m) => m.shoppingListId === shoppingListId);
}

// item helpers ---------------------------------------------------------------
function createItem({ shoppingListId, name, quantity = "", createdBy }) {
  const item = {
    itemId: genId("item"),
    shoppingListId,
    name,
    quantity,
    done: false,
    createdBy,
    doneBy: null,
    doneAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.items.push(item);
  return item;
}

function getItem(itemId) {
  return store.items.find((i) => i.itemId === itemId);
}

function updateItem(itemId, patch) {
  const item = getItem(itemId);
  if (!item) return null;
  Object.assign(item, patch, { updatedAt: new Date().toISOString() });
  return item;
}

function deleteItem(itemId) {
  const before = store.items.length;
  store.items = store.items.filter((i) => i.itemId !== itemId);
  return before !== store.items.length;
}

function listItems(shoppingListId, done) {
  return store.items.filter(
    (i) => i.shoppingListId === shoppingListId && (done === undefined || i.done === done)
  );
}

module.exports = {
  store,
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
