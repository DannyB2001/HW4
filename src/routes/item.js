// src/routes/item.js
const express = require("express");
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
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
  pageIndex: z.number().int().nonnegative().default(0),
  pageSize: z.number().int().positive().default(50)
});

function ensureItemExists(res, itemId) {
  const item = getItem(itemId);
  if (!item) {
    res.status(404).json({
      uuAppErrorMap: {
        "item/notFound": {
          type: "error",
          message: "Item not found.",
          paramMap: { itemId }
        }
      }
    });
    return null;
  }
  return item;
}

function ensureShoppingListExists(res, shoppingListId) {
  const shoppingList = getShoppingList(shoppingListId);
  if (!shoppingList) {
    res.status(404).json({
      uuAppErrorMap: {
        "shoppingList/notFound": {
          type: "error",
          message: "Shopping list not found.",
          paramMap: { shoppingListId }
        }
      }
    });
    return null;
  }
  return shoppingList;
}

function ensureMembership(shoppingListId, userId, roles, res) {
  const membership = findMembership(shoppingListId, userId);
  if (!membership || (roles && !roles.includes(membership.role))) {
    res.status(403).json({
      uuAppErrorMap: {
        "authorization/forbidden": {
          type: "error",
          message: "User is not allowed to access this shopping list.",
          paramMap: { shoppingListId, userId }
        }
      }
    });
    return null;
  }
  return membership;
}

/**
 * 9) item/create
 */
const createItemDtoIn = z.object({
  shoppingListId: z.string().min(1),
  name: z.string().min(1).max(255),
  quantity: z.string().optional()
});

router.post(
  "/create",
  auth(["owner", "member"]),
  validate(createItemDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    const shoppingList = ensureShoppingListExists(res, dtoIn.shoppingListId);
    if (!shoppingList) return;
    if (!ensureMembership(dtoIn.shoppingListId, req.userId, ["owner", "member"], res)) return;
    const item = createItem({
      shoppingListId: dtoIn.shoppingListId,
      name: dtoIn.name,
      quantity: dtoIn.quantity,
      createdBy: req.userId
    });
    return res.json({
      item,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 10) item/list
 */
const listItemDtoIn = z.object({
  shoppingListId: z.string().min(1),
  done: z.boolean().optional(),
  pageInfo: pageInfoSchema.optional()
});

router.post(
  "/list",
  auth(["owner", "member"]),
  validate(listItemDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    const shoppingList = ensureShoppingListExists(res, dtoIn.shoppingListId);
    if (!shoppingList) return;
    if (!ensureMembership(dtoIn.shoppingListId, req.userId, ["owner", "member"], res)) return;
    const pageIndex = dtoIn.pageInfo?.pageIndex ?? 0;
    const pageSize = dtoIn.pageInfo?.pageSize ?? 50;
    const all = listItems(dtoIn.shoppingListId, dtoIn.done);
    const start = pageIndex * pageSize;
    const items = all.slice(start, start + pageSize);
    return res.json({
      items,
      pageInfo: {
        pageIndex,
        pageSize,
        total: all.length
      },
      uuAppErrorMap: {}
    });
  }
);

/**
 * 11) item/update
 */
const updateItemDtoIn = z.object({
  itemId: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  quantity: z.string().optional()
});

router.post(
  "/update",
  auth(["owner", "member"]),
  validate(updateItemDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    const item = ensureItemExists(res, dtoIn.itemId);
    if (!item) return;
    const shoppingList = ensureShoppingListExists(res, item.shoppingListId);
    if (!shoppingList) return;
    if (!ensureMembership(item.shoppingListId, req.userId, ["owner", "member"], res)) return;
    const updated = updateItem(dtoIn.itemId, {
      name: dtoIn.name ?? item.name,
      quantity: dtoIn.quantity ?? item.quantity
    });
    return res.json({
      item: updated,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 12) item/markDone
 */
const markDoneDtoIn = z.object({
  itemId: z.string().min(1),
  done: z.boolean()
});

router.post(
  "/markDone",
  auth(["owner", "member"]),
  validate(markDoneDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    const item = ensureItemExists(res, dtoIn.itemId);
    if (!item) return;
    const shoppingList = ensureShoppingListExists(res, item.shoppingListId);
    if (!shoppingList) return;
    const membership = ensureMembership(item.shoppingListId, req.userId, ["owner", "member"], res);
    if (!membership) return;
    if (membership.role !== "owner" && !shoppingList.canMarkItemsDoneByAll) {
      return res.status(403).json({
        uuAppErrorMap: {
          "authorization/forbidden": {
            type: "error",
            message: "Member cannot mark items done for this shopping list.",
            paramMap: { shoppingListId: item.shoppingListId }
          }
        }
      });
    }
    const updated = updateItem(dtoIn.itemId, {
      done: dtoIn.done,
      doneBy: dtoIn.done ? req.userId : null,
      doneAt: dtoIn.done ? new Date().toISOString() : null
    });
    return res.json({
      item: updated,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 13) item/delete
 */
const deleteItemDtoIn = z.object({
  itemId: z.string().min(1)
});

router.post(
  "/delete",
  auth(["owner", "member"]),
  validate(deleteItemDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    const item = ensureItemExists(res, dtoIn.itemId);
    if (!item) return;
    const shoppingList = ensureShoppingListExists(res, item.shoppingListId);
    if (!shoppingList) return;
    if (!ensureMembership(item.shoppingListId, req.userId, ["owner", "member"], res)) return;
    deleteItem(dtoIn.itemId);
    return res.json({
      itemId: dtoIn.itemId,
      uuAppErrorMap: {}
    });
  }
);

module.exports = router;
