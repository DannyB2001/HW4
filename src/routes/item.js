const express = require("express");
const auth = require("../middleware/auth");
const { validateDtoIn, z } = require("../middleware/validate");
const {
  getShoppingList,
  findMembership,
  createItem,
  getItem,
  updateItem,
  deleteItem,
  listItems
} = require("../data/store");

const router = express.Router();

const pageInfoSchema = z.object({
  pageIndex: z.coerce.number().int().nonnegative().default(0),
  pageSize: z.coerce.number().int().positive().default(50)
});

const addError = (uuAppErrorMap, code, message, type = "error", paramMap = {}) => {
  uuAppErrorMap[code] = { type, message, paramMap };
};

const normalizeDtoFromQuery = (req, res, next) => {
  if (req.method === "GET" || req.method === "DELETE") {
    req.body = { ...req.query };
  }
  next();
};

const ensureItemExists = async (itemId, res, uuAppErrorMap, codePrefix) => {
  const item = await getItem(itemId);
  if (!item) {
    addError(uuAppErrorMap, `${codePrefix}/notFound`, "Item not found.", "error", { itemId });
    res.status(404).json({ uuAppErrorMap });
    return null;
  }
  return item;
};

const ensureShoppingListExists = async (shoppingListId, res, uuAppErrorMap, codePrefix) => {
  const shoppingList = await getShoppingList(shoppingListId);
  if (!shoppingList) {
    addError(
      uuAppErrorMap,
      `${codePrefix}/listNotFound`,
      "Shopping list not found.",
      "error",
      { shoppingListId }
    );
    res.status(404).json({ uuAppErrorMap });
    return null;
  }
  return shoppingList;
};

const ensureMembership = async (
  shoppingListId,
  userId,
  roles,
  res,
  uuAppErrorMap,
  codePrefix
) => {
  const membership = await findMembership(shoppingListId, userId);
  if (!membership || (roles && !roles.includes(membership.role))) {
    addError(
      uuAppErrorMap,
      `${codePrefix}/notAuthorized`,
      "User is not allowed to access this shopping list.",
      "error",
      { shoppingListId, userId }
    );
    res.status(403).json({ uuAppErrorMap });
    return null;
  }
  return membership;
};

/**
 * 9) item/create
 */
const createItemDtoIn = z.object({
  shoppingListId: z.string().min(1),
  name: z.string().min(1).max(255),
  quantity: z.string().optional().default(""),
  note: z.string().optional().default("")
});

const handleCreate = [
  auth,
  validateDtoIn(createItemDtoIn, "item/create"),
  async (req, res) => {
    const uuAppErrorMap = { ...(req.uuAppErrorMap || {}) };
    try {
      const dtoIn = req.dtoIn;
      const shoppingList = await ensureShoppingListExists(
        dtoIn.shoppingListId,
        res,
        uuAppErrorMap,
        "item/create"
      );
      if (!shoppingList) return;
      if (
        !(await ensureMembership(
          dtoIn.shoppingListId,
          req.user.id,
          ["owner", "member"],
          res,
          uuAppErrorMap,
          "item/create"
        ))
      )
        return;
      const item = await createItem({
        shoppingListId: dtoIn.shoppingListId,
        name: dtoIn.name,
        quantity: dtoIn.quantity,
        note: dtoIn.note,
        createdBy: req.user.id
      });
      if (!item) {
        addError(
          uuAppErrorMap,
          "item/create/systemError",
          "Item could not be created.",
          "error"
        );
        return res.status(500).json({ uuAppErrorMap });
      }
      return res.json({ item, uuAppErrorMap });
    } catch (error) {
      console.error("item/create failed:", error);
      addError(uuAppErrorMap, "item/create/systemError", "Unexpected server error.", "error");
      return res.status(500).json({ uuAppErrorMap });
    }
  }
];

router.post("/create", ...handleCreate);

/**
 * 10) item/list
 */
const listItemDtoIn = z.object({
  shoppingListId: z.string().min(1),
  done: z.coerce.boolean().optional(),
  pageInfo: pageInfoSchema.optional()
});

const handleList = [
  auth,
  normalizeDtoFromQuery,
  validateDtoIn(listItemDtoIn, "item/list"),
  async (req, res) => {
    const uuAppErrorMap = { ...(req.uuAppErrorMap || {}) };
    try {
      const dtoIn = req.dtoIn;
      const shoppingList = await ensureShoppingListExists(
        dtoIn.shoppingListId,
        res,
        uuAppErrorMap,
        "item/list"
      );
      if (!shoppingList) return;
      if (
        !(await ensureMembership(
          dtoIn.shoppingListId,
          req.user.id,
          ["owner", "member"],
          res,
          uuAppErrorMap,
          "item/list"
        ))
      )
        return;
      const pageIndex = dtoIn.pageInfo?.pageIndex ?? 0;
      const pageSize = dtoIn.pageInfo?.pageSize ?? 50;
      const all = await listItems(dtoIn.shoppingListId, dtoIn.done);
      const start = pageIndex * pageSize;
      const items = all.slice(start, start + pageSize);
      return res.json({
        items,
        pageInfo: {
          pageIndex,
          pageSize,
          total: all.length
        },
        uuAppErrorMap
      });
    } catch (error) {
      console.error("item/list failed:", error);
      addError(uuAppErrorMap, "item/list/systemError", "Unexpected server error.", "error");
      return res.status(500).json({ uuAppErrorMap });
    }
  }
];

router.post("/list", ...handleList);
router.get("/list", ...handleList);

/**
 * 11) item/update
 */
const updateItemDtoIn = z.object({
  itemId: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  quantity: z.string().optional(),
  note: z.string().optional()
});

const handleUpdate = [
  auth,
  validateDtoIn(updateItemDtoIn, "item/update"),
  async (req, res) => {
    const uuAppErrorMap = { ...(req.uuAppErrorMap || {}) };
    try {
      const dtoIn = req.dtoIn;
      const item = await ensureItemExists(dtoIn.itemId, res, uuAppErrorMap, "item/update");
      if (!item) return;
      const shoppingList = await ensureShoppingListExists(
        item.shoppingListId,
        res,
        uuAppErrorMap,
        "item/update"
      );
      if (!shoppingList) return;
      if (
        !(await ensureMembership(
          item.shoppingListId,
          req.user.id,
          ["owner", "member"],
          res,
          uuAppErrorMap,
          "item/update"
        ))
      )
        return;
      const updated = await updateItem(dtoIn.itemId, {
        text: dtoIn.name ?? item.name,
        name: dtoIn.name ?? item.name,
        amount: dtoIn.quantity ?? item.quantity,
        note: dtoIn.note ?? item.note
      });
      return res.json({ item: updated, uuAppErrorMap });
    } catch (error) {
      console.error("item/update failed:", error);
      addError(uuAppErrorMap, "item/update/systemError", "Unexpected server error.", "error");
      return res.status(500).json({ uuAppErrorMap });
    }
  }
];

router.post("/update", ...handleUpdate);
router.patch("/update", ...handleUpdate);

/**
 * 12) item/markDone
 */
const markDoneDtoIn = z.object({
  itemId: z.string().min(1),
  done: z.coerce.boolean()
});

const handleMarkDone = [
  auth,
  validateDtoIn(markDoneDtoIn, "item/markDone"),
  async (req, res) => {
    const uuAppErrorMap = { ...(req.uuAppErrorMap || {}) };
    try {
      const dtoIn = req.dtoIn;
      const item = await ensureItemExists(dtoIn.itemId, res, uuAppErrorMap, "item/markDone");
      if (!item) return;
      const shoppingList = await ensureShoppingListExists(
        item.shoppingListId,
        res,
        uuAppErrorMap,
        "item/markDone"
      );
      if (!shoppingList) return;
      const membership = await ensureMembership(
        item.shoppingListId,
        req.user.id,
        ["owner", "member"],
        res,
        uuAppErrorMap,
        "item/markDone"
      );
      if (!membership) return;
      if (membership.role !== "owner" && !shoppingList.canMarkItemsDoneByAll) {
        addError(
          uuAppErrorMap,
          "item/markDone/notAuthorized",
          "Member cannot mark items done for this shopping list.",
          "error",
          { shoppingListId: item.shoppingListId }
        );
        return res.status(403).json({ uuAppErrorMap });
      }
      const updated = await updateItem(dtoIn.itemId, {
        isDone: dtoIn.done,
        doneBy: dtoIn.done ? req.user.id : null,
        doneAt: dtoIn.done ? new Date().toISOString() : null
      });
      return res.json({ item: updated, uuAppErrorMap });
    } catch (error) {
      console.error("item/markDone failed:", error);
      addError(uuAppErrorMap, "item/markDone/systemError", "Unexpected server error.", "error");
      return res.status(500).json({ uuAppErrorMap });
    }
  }
];

router.post("/markDone", ...handleMarkDone);
router.patch("/markDone", ...handleMarkDone);

/**
 * 13) item/delete
 */
const deleteItemDtoIn = z.object({
  itemId: z.string().min(1)
});

const handleDelete = [
  auth,
  normalizeDtoFromQuery,
  validateDtoIn(deleteItemDtoIn, "item/delete"),
  async (req, res) => {
    const uuAppErrorMap = { ...(req.uuAppErrorMap || {}) };
    try {
      const dtoIn = req.dtoIn;
      const item = await ensureItemExists(dtoIn.itemId, res, uuAppErrorMap, "item/delete");
      if (!item) return;
      const shoppingList = await ensureShoppingListExists(
        item.shoppingListId,
        res,
        uuAppErrorMap,
        "item/delete"
      );
      if (!shoppingList) return;
      if (
        !(await ensureMembership(
          item.shoppingListId,
          req.user.id,
          ["owner", "member"],
          res,
          uuAppErrorMap,
          "item/delete"
        ))
      )
        return;
      const removed = await deleteItem(dtoIn.itemId);
      if (!removed) {
        addError(
          uuAppErrorMap,
          "item/delete/notDeleted",
          "Item could not be deleted.",
          "error",
          { itemId: dtoIn.itemId }
        );
        return res.status(400).json({ uuAppErrorMap });
      }
      return res.json({ itemId: dtoIn.itemId, uuAppErrorMap });
    } catch (error) {
      console.error("item/delete failed:", error);
      addError(uuAppErrorMap, "item/delete/systemError", "Unexpected server error.", "error");
      return res.status(500).json({ uuAppErrorMap });
    }
  }
];

router.post("/delete", ...handleDelete);
router.delete("/delete", ...handleDelete);

module.exports = router;
