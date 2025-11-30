// src/routes/shoppingList.js
const express = require("express");
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const {
  createShoppingList,
  getShoppingList,
  updateShoppingList,
  deleteShoppingList,
  listShoppingListsByUser,
  findMembership,
  addMembership,
  removeMembership,
  listMembers
} = require("../data/store");

const router = express.Router();

const pageInfoSchema = z.object({
  pageIndex: z.number().int().nonnegative().default(0),
  pageSize: z.number().int().positive().default(50)
});

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
 * 1) shoppingList/create
 */
const createShoppingListDtoIn = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  canMarkItemsDoneByAll: z.boolean().optional()
});

router.post(
  "/create",
  auth(["user"]),
  validate(createShoppingListDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    const shoppingList = createShoppingList({
      name: dtoIn.name,
      description: dtoIn.description,
      canMarkItemsDoneByAll: dtoIn.canMarkItemsDoneByAll,
      ownerId: req.userId
    });
    return res.json({
      shoppingList,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 2) shoppingList/listMine
 */
const listMineDtoIn = z
  .object({
    state: z.enum(["active", "archived"]).optional(),
    pageInfo: pageInfoSchema.optional()
  })
  .default({});

router.post(
  "/listMine",
  auth(["user"]),
  validate(listMineDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn || {};
    const pageIndex = dtoIn.pageInfo?.pageIndex ?? 0;
    const pageSize = dtoIn.pageInfo?.pageSize ?? 50;
    const all = listShoppingListsByUser(req.userId, dtoIn.state);
    const start = pageIndex * pageSize;
    const shoppingLists = all.slice(start, start + pageSize);
    return res.json({
      shoppingLists,
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
 * 3) shoppingList/get
 */
const getShoppingListDtoIn = z.object({
  shoppingListId: z.string().min(1)
});

router.post(
  "/get",
  auth(["owner", "member", "user"]),
  validate(getShoppingListDtoIn),
  (req, res) => {
    const { shoppingListId } = req.dtoIn;
    const shoppingList = ensureShoppingListExists(res, shoppingListId);
    if (!shoppingList) return;
    if (!ensureMembership(shoppingListId, req.userId, ["owner", "member"], res)) return;
    return res.json({
      shoppingList,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 4) shoppingList/update
 */
const updateShoppingListDtoIn = z.object({
  shoppingListId: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  canMarkItemsDoneByAll: z.boolean().optional(),
  state: z.enum(["active", "archived"]).optional()
});

router.post(
  "/update",
  auth(["owner"]),
  validate(updateShoppingListDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    const shoppingList = ensureShoppingListExists(res, dtoIn.shoppingListId);
    if (!shoppingList) return;
    if (!ensureMembership(dtoIn.shoppingListId, req.userId, ["owner"], res)) return;
    const updated = updateShoppingList(dtoIn.shoppingListId, {
      name: dtoIn.name ?? shoppingList.name,
      description: dtoIn.description ?? shoppingList.description,
      canMarkItemsDoneByAll:
        dtoIn.canMarkItemsDoneByAll ?? shoppingList.canMarkItemsDoneByAll,
      state: dtoIn.state ?? shoppingList.state
    });
    return res.json({
      shoppingList: updated,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 5) shoppingList/delete
 */
const deleteShoppingListDtoIn = z.object({
  shoppingListId: z.string().min(1)
});

router.post(
  "/delete",
  auth(["owner"]),
  validate(deleteShoppingListDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    const shoppingList = ensureShoppingListExists(res, dtoIn.shoppingListId);
    if (!shoppingList) return;
    if (!ensureMembership(dtoIn.shoppingListId, req.userId, ["owner"], res)) return;
    deleteShoppingList(dtoIn.shoppingListId);
    return res.json({
      shoppingListId: dtoIn.shoppingListId,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 6) shoppingList/addMember
 */
const addMemberDtoIn = z.object({
  shoppingListId: z.string().min(1),
  memberId: z.string().min(1),
  role: z.enum(["member", "owner"]).optional()
});

router.post(
  "/addMember",
  auth(["owner"]),
  validate(addMemberDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    const shoppingList = ensureShoppingListExists(res, dtoIn.shoppingListId);
    if (!shoppingList) return;
    if (!ensureMembership(dtoIn.shoppingListId, req.userId, ["owner"], res)) return;
    const { membership, alreadyExisted } = addMembership({
      shoppingListId: dtoIn.shoppingListId,
      memberId: dtoIn.memberId,
      role: dtoIn.role || "member"
    });
    return res.json({
      membership,
      uuAppErrorMap: alreadyExisted
        ? {
            "membership/alreadyExists": {
              type: "warning",
              message: "Member already exists, returning existing membership.",
              paramMap: { memberId: dtoIn.memberId }
            }
          }
        : {}
    });
  }
);

/**
 * 7) shoppingList/removeMember
 */
const removeMemberDtoIn = z.object({
  shoppingListId: z.string().min(1),
  memberId: z.string().min(1)
});

router.post(
  "/removeMember",
  auth(["owner"]),
  validate(removeMemberDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    const shoppingList = ensureShoppingListExists(res, dtoIn.shoppingListId);
    if (!shoppingList) return;
    if (!ensureMembership(dtoIn.shoppingListId, req.userId, ["owner"], res)) return;
    const removed = removeMembership(dtoIn.shoppingListId, dtoIn.memberId);
    return res.json({
      removed,
      uuAppErrorMap: removed
        ? {}
        : {
            "membership/notFound": {
              type: "warning",
              message: "Member not found on this shopping list.",
              paramMap: { memberId: dtoIn.memberId }
            }
          }
    });
  }
);

/**
 * 8) shoppingList/listMembers
 */
const listMembersDtoIn = z.object({
  shoppingListId: z.string().min(1)
});

router.post(
  "/listMembers",
  auth(["owner", "member"]),
  validate(listMembersDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    const shoppingList = ensureShoppingListExists(res, dtoIn.shoppingListId);
    if (!shoppingList) return;
    if (!ensureMembership(dtoIn.shoppingListId, req.userId, ["owner", "member"], res)) return;
    const members = listMembers(dtoIn.shoppingListId);
    return res.json({
      members,
      uuAppErrorMap: {}
    });
  }
);

module.exports = router;
