// src/routes/item.js
const express = require("express");
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");

const router = express.Router();

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
    return res.json({
      dtoIn,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 10) item/list
 */
const listItemDtoIn = z.object({
  shoppingListId: z.string().min(1),
  done: z.boolean().optional()
});

router.post(
  "/list",
  auth(["owner", "member"]),
  validate(listItemDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    return res.json({
      dtoIn,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 11) item/update
 */
const updateItemDtoIn = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  quantity: z.string().optional()
});

router.post(
  "/update",
  auth(["owner", "member"]),
  validate(updateItemDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    return res.json({
      dtoIn,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 12) item/markDone
 */
const markDoneDtoIn = z.object({
  id: z.string().min(1),
  done: z.boolean()
});

router.post(
  "/markDone",
  auth(["owner", "member"]),
  validate(markDoneDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    return res.json({
      dtoIn,
      uuAppErrorMap: {}
    });
  }
);

/**
 * 13) item/delete
 */
const deleteItemDtoIn = z.object({
  id: z.string().min(1)
});

router.post(
  "/delete",
  auth(["owner", "member"]),
  validate(deleteItemDtoIn),
  (req, res) => {
    const dtoIn = req.dtoIn;
    return res.json({
      dtoIn,
      uuAppErrorMap: {}
    });
  }
);

module.exports = router;
