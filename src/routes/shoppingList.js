const express = require("express");
const auth = require("../middleware/auth");
const { validateDtoIn, z } = require("../middleware/validate");
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

const ensureShoppingListExists = async (shoppingListId, res, uuAppErrorMap, codePrefix) => {
  const shoppingList = await getShoppingList(shoppingListId);
  if (!shoppingList) {
    addError(
      uuAppErrorMap,
      `${codePrefix}/notFound`,
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
 * 1) shoppingList/create
 */
const createShoppingListDtoIn = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().default(""),
  canMarkItemsDoneByAll: z.coerce.boolean().optional().default(false)
});

const handleCreate = [
  auth,
  validateDtoIn(createShoppingListDtoIn, "shoppingList/create"),
  async (req, res) => {
    const uuAppErrorMap = { ...(req.uuAppErrorMap || {}) };
    try {
      const dtoIn = req.dtoIn;
      const shoppingList = await createShoppingList({
        name: dtoIn.name,
        description: dtoIn.description,
        canMarkItemsDoneByAll: dtoIn.canMarkItemsDoneByAll,
        ownerId: req.user.id
      });
      return res.json({ shoppingList, uuAppErrorMap });
    } catch (error) {
      console.error("shoppingList/create failed:", error);
      addError(
        uuAppErrorMap,
        "shoppingList/create/systemError",
        "Unexpected server error.",
        "error"
      );
      return res.status(500).json({ uuAppErrorMap });
    }
  }
];

router.post("/create", ...handleCreate);

/**
 * 2) shoppingList/listMine
 */
const listMineDtoIn = z
  .object({
    state: z.enum(["active", "archived"]).optional(),
    pageInfo: pageInfoSchema.optional()
  })
  .default({});

const handleListMine = [
  auth,
  normalizeDtoFromQuery,
  validateDtoIn(listMineDtoIn, "shoppingList/listMine"),
  async (req, res) => {
    const uuAppErrorMap = { ...(req.uuAppErrorMap || {}) };
    try {
      const dtoIn = req.dtoIn || {};
      const pageIndex = dtoIn.pageInfo?.pageIndex ?? 0;
      const pageSize = dtoIn.pageInfo?.pageSize ?? 50;
      const all = await listShoppingListsByUser(req.user.id, dtoIn.state);
      const start = pageIndex * pageSize;
      const shoppingLists = all.slice(start, start + pageSize);
      return res.json({
        shoppingLists,
        pageInfo: {
          pageIndex,
          pageSize,
          total: all.length
        },
        uuAppErrorMap
      });
    } catch (error) {
      console.error("shoppingList/listMine failed:", error);
      addError(
        uuAppErrorMap,
        "shoppingList/listMine/systemError",
        "Unexpected server error.",
        "error"
      );
      return res.status(500).json({ uuAppErrorMap });
    }
  }
];

router.post("/listMine", ...handleListMine);
router.get("/listMine", ...handleListMine);

/**
 * 3) shoppingList/get
 */
const getShoppingListDtoIn = z.object({
  shoppingListId: z.string().min(1)
});

const handleGet = [
  auth,
  normalizeDtoFromQuery,
  validateDtoIn(getShoppingListDtoIn, "shoppingList/get"),
  async (req, res) => {
    const uuAppErrorMap = { ...(req.uuAppErrorMap || {}) };
    try {
      const { shoppingListId } = req.dtoIn;
      const shoppingList = await ensureShoppingListExists(
        shoppingListId,
        res,
        uuAppErrorMap,
        "shoppingList/get"
      );
      if (!shoppingList) return;
      if (
        !(await ensureMembership(
          shoppingListId,
          req.user.id,
          ["owner", "member"],
          res,
          uuAppErrorMap,
          "shoppingList/get"
        ))
      )
        return;
      return res.json({ shoppingList, uuAppErrorMap });
    } catch (error) {
      console.error("shoppingList/get failed:", error);
      addError(
        uuAppErrorMap,
        "shoppingList/get/systemError",
        "Unexpected server error.",
        "error"
      );
      return res.status(500).json({ uuAppErrorMap });
    }
  }
];

router.post("/get", ...handleGet);
router.get("/get", ...handleGet);

/**
 * 4) shoppingList/update
 */
const updateShoppingListDtoIn = z.object({
  shoppingListId: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  canMarkItemsDoneByAll: z.coerce.boolean().optional(),
  state: z.enum(["active", "archived"]).optional()
});

const handleUpdate = [
  auth,
  validateDtoIn(updateShoppingListDtoIn, "shoppingList/update"),
  async (req, res) => {
    const uuAppErrorMap = { ...(req.uuAppErrorMap || {}) };
    try {
      const dtoIn = req.dtoIn;
      const shoppingList = await ensureShoppingListExists(
        dtoIn.shoppingListId,
        res,
        uuAppErrorMap,
        "shoppingList/update"
      );
      if (!shoppingList) return;
      if (
        !(await ensureMembership(
          dtoIn.shoppingListId,
          req.user.id,
          ["owner"],
          res,
          uuAppErrorMap,
          "shoppingList/update"
        ))
      )
        return;
      const updated = await updateShoppingList(dtoIn.shoppingListId, {
        name: dtoIn.name ?? shoppingList.name,
        description: dtoIn.description ?? shoppingList.description,
        canMarkItemsDoneByAll:
          dtoIn.canMarkItemsDoneByAll ?? shoppingList.canMarkItemsDoneByAll,
        state: dtoIn.state ?? shoppingList.state
      });
      return res.json({ shoppingList: updated, uuAppErrorMap });
    } catch (error) {
      console.error("shoppingList/update failed:", error);
      addError(
        uuAppErrorMap,
        "shoppingList/update/systemError",
        "Unexpected server error.",
        "error"
      );
      return res.status(500).json({ uuAppErrorMap });
    }
  }
];

router.post("/update", ...handleUpdate);
router.patch("/update", ...handleUpdate);

/**
 * 5) shoppingList/delete
 */
const deleteShoppingListDtoIn = z.object({
  shoppingListId: z.string().min(1)
});

const handleDelete = [
  auth,
  normalizeDtoFromQuery,
  validateDtoIn(deleteShoppingListDtoIn, "shoppingList/delete"),
  async (req, res) => {
    const uuAppErrorMap = { ...(req.uuAppErrorMap || {}) };
    try {
      const dtoIn = req.dtoIn;
      const shoppingList = await ensureShoppingListExists(
        dtoIn.shoppingListId,
        res,
        uuAppErrorMap,
        "shoppingList/delete"
      );
      if (!shoppingList) return;
      if (
        !(await ensureMembership(
          dtoIn.shoppingListId,
          req.user.id,
          ["owner"],
          res,
          uuAppErrorMap,
          "shoppingList/delete"
        ))
      )
        return;
      const removed = await deleteShoppingList(dtoIn.shoppingListId);
      if (!removed) {
        addError(
          uuAppErrorMap,
          "shoppingList/delete/notDeleted",
          "Shopping list could not be deleted.",
          "error",
          { shoppingListId: dtoIn.shoppingListId }
        );
        return res.status(400).json({ uuAppErrorMap });
      }
      return res.json({ shoppingListId: dtoIn.shoppingListId, uuAppErrorMap });
    } catch (error) {
      console.error("shoppingList/delete failed:", error);
      addError(
        uuAppErrorMap,
        "shoppingList/delete/systemError",
        "Unexpected server error.",
        "error"
      );
      return res.status(500).json({ uuAppErrorMap });
    }
  }
];

router.post("/delete", ...handleDelete);
router.delete("/delete", ...handleDelete);

/**
 * 6) shoppingList/addMember
 */
const addMemberDtoIn = z.object({
  shoppingListId: z.string().min(1),
  memberId: z.string().min(1),
  role: z.enum(["member", "owner"]).optional()
});

const handleAddMember = [
  auth,
  validateDtoIn(addMemberDtoIn, "shoppingList/addMember"),
  async (req, res) => {
    const uuAppErrorMap = { ...(req.uuAppErrorMap || {}) };
    try {
      const dtoIn = req.dtoIn;
      const shoppingList = await ensureShoppingListExists(
        dtoIn.shoppingListId,
        res,
        uuAppErrorMap,
        "shoppingList/addMember"
      );
      if (!shoppingList) return;
      if (
        !(await ensureMembership(
          dtoIn.shoppingListId,
          req.user.id,
          ["owner"],
          res,
          uuAppErrorMap,
          "shoppingList/addMember"
        ))
      )
        return;
      const { membership, alreadyExisted } = await addMembership({
        shoppingListId: dtoIn.shoppingListId,
        memberId: dtoIn.memberId,
        role: dtoIn.role || "member",
        createdBy: req.user.id
      });
      if (alreadyExisted) {
        addError(
          uuAppErrorMap,
          "shoppingList/addMember/alreadyExists",
          "Member already exists, returning existing membership.",
          "warning",
          { memberId: dtoIn.memberId }
        );
      }
      return res.json({ membership, uuAppErrorMap });
    } catch (error) {
      console.error("shoppingList/addMember failed:", error);
      addError(
        uuAppErrorMap,
        "shoppingList/addMember/systemError",
        "Unexpected server error.",
        "error"
      );
      return res.status(500).json({ uuAppErrorMap });
    }
  }
];

router.post("/addMember", ...handleAddMember);

/**
 * 7) shoppingList/removeMember
 */
const removeMemberDtoIn = z.object({
  shoppingListId: z.string().min(1),
  memberId: z.string().min(1)
});

const handleRemoveMember = [
  auth,
  normalizeDtoFromQuery,
  validateDtoIn(removeMemberDtoIn, "shoppingList/removeMember"),
  async (req, res) => {
    const uuAppErrorMap = { ...(req.uuAppErrorMap || {}) };
    try {
      const dtoIn = req.dtoIn;
      const shoppingList = await ensureShoppingListExists(
        dtoIn.shoppingListId,
        res,
        uuAppErrorMap,
        "shoppingList/removeMember"
      );
      if (!shoppingList) return;
      if (
        !(await ensureMembership(
          dtoIn.shoppingListId,
          req.user.id,
          ["owner"],
          res,
          uuAppErrorMap,
          "shoppingList/removeMember"
        ))
      )
        return;
      const removed = await removeMembership(dtoIn.shoppingListId, dtoIn.memberId);
      if (!removed) {
        addError(
          uuAppErrorMap,
          "shoppingList/removeMember/notFound",
          "Member not found on this shopping list.",
          "warning",
          { memberId: dtoIn.memberId }
        );
      }
      return res.json({ removed, uuAppErrorMap });
    } catch (error) {
      console.error("shoppingList/removeMember failed:", error);
      addError(
        uuAppErrorMap,
        "shoppingList/removeMember/systemError",
        "Unexpected server error.",
        "error"
      );
      return res.status(500).json({ uuAppErrorMap });
    }
  }
];

router.post("/removeMember", ...handleRemoveMember);
router.delete("/removeMember", ...handleRemoveMember);

/**
 * 8) shoppingList/listMembers
 */
const listMembersDtoIn = z.object({
  shoppingListId: z.string().min(1)
});

const handleListMembers = [
  auth,
  normalizeDtoFromQuery,
  validateDtoIn(listMembersDtoIn, "shoppingList/listMembers"),
  async (req, res) => {
    const uuAppErrorMap = { ...(req.uuAppErrorMap || {}) };
    try {
      const dtoIn = req.dtoIn;
      const shoppingList = await ensureShoppingListExists(
        dtoIn.shoppingListId,
        res,
        uuAppErrorMap,
        "shoppingList/listMembers"
      );
      if (!shoppingList) return;
      if (
        !(await ensureMembership(
          dtoIn.shoppingListId,
          req.user.id,
          ["owner", "member"],
          res,
          uuAppErrorMap,
          "shoppingList/listMembers"
        ))
      )
        return;
      const members = await listMembers(dtoIn.shoppingListId);
      return res.json({ members, uuAppErrorMap });
    } catch (error) {
      console.error("shoppingList/listMembers failed:", error);
      addError(
        uuAppErrorMap,
        "shoppingList/listMembers/systemError",
        "Unexpected server error.",
        "error"
      );
      return res.status(500).json({ uuAppErrorMap });
    }
  }
];

router.post("/listMembers", ...handleListMembers);
router.get("/listMembers", ...handleListMembers);

module.exports = router;
