// src/routes/shoppingList.js
const express = require("express");
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");

const router = express.Router();

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
  auth(["user"]),                    // profile: user
  validate(createShoppingListDtoIn), // dtoIn validation
  (req, res) => {
    const dtoIn = req.dtoIn;
    return res.json({
      dtoIn,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 2) shoppingList/listMine
 * - tady můžeme mít prázdné dtoIn, nebo jednoduchý filtr
 */
const listMineDtoIn = z.object({
  state: z.enum(["active", "archived"]).optional(),
  pageIndex: z.number().int().nonnegative().optional(),
  pageSize: z.number().int().positive().optional()
}).optional(); // dtoIn může být i prázdný objekt

router.post(
  "/listMine",
  auth(["user"]),          // každý přihlášený user
  validate(listMineDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn || {};
    return res.json({
      dtoIn,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 3) shoppingList/get
 */
const getShoppingListDtoIn = z.object({
  id: z.string().min(1)
});

router.post(
  "/get",
  auth(["owner", "member", "user"]), // podle návrhu klidně jen owner+member
  validate(getShoppingListDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    return res.json({
      dtoIn,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 4) shoppingList/update
 */
const updateShoppingListDtoIn = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  canMarkItemsDoneByAll: z.boolean().optional(),
  state: z.enum(["active", "archived"]).optional()
});

router.post(
  "/update",
  auth(["owner"]), // jen owner může měnit list
  validate(updateShoppingListDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    return res.json({
      dtoIn,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 5) shoppingList/delete
 */
const deleteShoppingListDtoIn = z.object({
  id: z.string().min(1)
});

router.post(
  "/delete",
  auth(["owner"]),
  validate(deleteShoppingListDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    return res.json({
      dtoIn,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 6) shoppingList/addMember
 */
const addMemberDtoIn = z.object({
  shoppingListId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["member", "owner"]).optional() // typicky přidáváš membera
});

router.post(
  "/addMember",
  auth(["owner"]),
  validate(addMemberDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    return res.json({
      dtoIn,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 7) shoppingList/removeMember
 */
const removeMemberDtoIn = z.object({
  shoppingListId: z.string().min(1),
  userId: z.string().min(1)
});

router.post(
  "/removeMember",
  auth(["owner"]),
  validate(removeMemberDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    return res.json({
      dtoIn,
      uuAppErrorMap: {}
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
    return res.json({
      dtoIn,
      uuAppErrorMap: {}
    });
  }
);

module.exports = router;
