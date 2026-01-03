const request = require("supertest");

const mockStore = {
  connectToDb: jest.fn(),
  createShoppingList: jest.fn(),
  getShoppingList: jest.fn(),
  updateShoppingList: jest.fn(),
  deleteShoppingList: jest.fn(),
  listShoppingListsByUser: jest.fn(),
  findMembership: jest.fn(),
  addMembership: jest.fn(),
  removeMembership: jest.fn(),
  listMembers: jest.fn(),
  createItem: jest.fn(),
  getItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
  listItems: jest.fn()
};

jest.mock("../src/data/store", () => mockStore);

const app = require("../src/App");

const ownerId = "user-1";
const memberId = "user-2";
const baseList = {
  shoppingListId: "list-1",
  name: "Groceries",
  description: "Weekly shopping",
  state: "active",
  canMarkItemsDoneByAll: false,
  createdBy: ownerId,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z"
};

beforeEach(() => {
  Object.values(mockStore).forEach((fn) => {
    if (typeof fn.mock === "function") fn.mockReset();
  });
});

describe("shoppingList/create", () => {
  test("creates a shopping list for the authenticated user", async () => {
    mockStore.createShoppingList.mockResolvedValue(baseList);

    const res = await request(app)
      .post("/shoppingList/create")
      .set("x-user-id", ownerId)
      .send({ name: baseList.name, description: baseList.description, canMarkItemsDoneByAll: true });

    expect(res.status).toBe(200);
    expect(res.body.shoppingList).toEqual(baseList);
    expect(res.body.uuAppErrorMap).toEqual({});
    expect(mockStore.createShoppingList).toHaveBeenCalledWith({
      name: baseList.name,
      description: baseList.description,
      canMarkItemsDoneByAll: true,
      ownerId
    });
  });

  test("rejects invalid dtoIn payloads", async () => {
    const res = await request(app)
      .post("/shoppingList/create")
      .set("x-user-id", ownerId)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.uuAppErrorMap["shoppingList/create/invalidDtoIn"]).toBeDefined();
  });
});

describe("shoppingList/listMine", () => {
  test("paginates shopping lists for the caller", async () => {
    const lists = [
      baseList,
      { ...baseList, shoppingListId: "list-2", name: "Hardware" },
      { ...baseList, shoppingListId: "list-3", name: "Pharmacy" }
    ];
    mockStore.listShoppingListsByUser.mockResolvedValue(lists);

    const res = await request(app)
      .post("/shoppingList/listMine")
      .set("x-user-id", ownerId)
      .send({ state: "active", pageInfo: { pageIndex: 0, pageSize: 2 } });

    expect(res.status).toBe(200);
    expect(res.body.shoppingLists).toHaveLength(2);
    expect(res.body.pageInfo).toMatchObject({ pageIndex: 0, pageSize: 2, total: 3 });
    expect(mockStore.listShoppingListsByUser).toHaveBeenCalledWith(ownerId, "active");
  });

  test("requires authentication", async () => {
    const res = await request(app).get("/shoppingList/listMine");

    expect(res.status).toBe(401);
    expect(res.body.uuAppErrorMap["authentication/invalidIdentity"]).toBeDefined();
  });
});

describe("shoppingList/get", () => {
  test("returns a shopping list when membership is valid", async () => {
    mockStore.getShoppingList.mockResolvedValue(baseList);
    mockStore.findMembership.mockResolvedValue({ membershipId: "m1", shoppingListId: baseList.shoppingListId, role: "owner" });

    const res = await request(app)
      .get("/shoppingList/get")
      .set("x-user-id", ownerId)
      .query({ shoppingListId: baseList.shoppingListId });

    expect(res.status).toBe(200);
    expect(res.body.shoppingList).toEqual(baseList);
    expect(mockStore.findMembership).toHaveBeenCalledWith(baseList.shoppingListId, ownerId);
  });

  test("returns 404 for missing shopping list", async () => {
    mockStore.getShoppingList.mockResolvedValue(null);

    const res = await request(app)
      .get("/shoppingList/get")
      .set("x-user-id", ownerId)
      .query({ shoppingListId: "missing-list" });

    expect(res.status).toBe(404);
    expect(res.body.uuAppErrorMap["shoppingList/get/notFound"]).toBeDefined();
  });
});

describe("shoppingList/update", () => {
  test("allows owner to update list details", async () => {
    const updated = { ...baseList, name: "Updated name", description: "New description" };
    mockStore.getShoppingList.mockResolvedValue(baseList);
    mockStore.findMembership.mockResolvedValue({ membershipId: "m1", shoppingListId: baseList.shoppingListId, role: "owner" });
    mockStore.updateShoppingList.mockResolvedValue(updated);

    const res = await request(app)
      .patch("/shoppingList/update")
      .set("x-user-id", ownerId)
      .send({ shoppingListId: baseList.shoppingListId, name: updated.name, description: updated.description });

    expect(res.status).toBe(200);
    expect(res.body.shoppingList).toEqual(updated);
    expect(mockStore.updateShoppingList).toHaveBeenCalledWith(baseList.shoppingListId, {
      name: updated.name,
      description: updated.description,
      canMarkItemsDoneByAll: baseList.canMarkItemsDoneByAll,
      state: baseList.state
    });
  });

  test("rejects updates from non-owner members", async () => {
    mockStore.getShoppingList.mockResolvedValue(baseList);
    mockStore.findMembership.mockResolvedValue({ membershipId: "m2", shoppingListId: baseList.shoppingListId, role: "member" });

    const res = await request(app)
      .post("/shoppingList/update")
      .set("x-user-id", memberId)
      .send({ shoppingListId: baseList.shoppingListId, name: "Nope" });

    expect(res.status).toBe(403);
    expect(res.body.uuAppErrorMap["shoppingList/update/notAuthorized"]).toBeDefined();
  });
});

describe("shoppingList/delete", () => {
  test("deletes a shopping list when called by owner", async () => {
    mockStore.getShoppingList.mockResolvedValue(baseList);
    mockStore.findMembership.mockResolvedValue({ membershipId: "m1", shoppingListId: baseList.shoppingListId, role: "owner" });
    mockStore.deleteShoppingList.mockResolvedValue(true);

    const res = await request(app)
      .delete("/shoppingList/delete")
      .set("x-user-id", ownerId)
      .query({ shoppingListId: baseList.shoppingListId });

    expect(res.status).toBe(200);
    expect(res.body.shoppingListId).toBe(baseList.shoppingListId);
    expect(mockStore.deleteShoppingList).toHaveBeenCalledWith(baseList.shoppingListId);
  });

  test("returns 404 when shopping list does not exist", async () => {
    mockStore.getShoppingList.mockResolvedValue(null);

    const res = await request(app)
      .delete("/shoppingList/delete")
      .set("x-user-id", ownerId)
      .query({ shoppingListId: "missing-list" });

    expect(res.status).toBe(404);
    expect(res.body.uuAppErrorMap["shoppingList/delete/notFound"]).toBeDefined();
  });
});
