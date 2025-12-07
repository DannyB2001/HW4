const { z } = require("zod");

const buildIssueMaps = (issues) => {
  const invalidTypeKeyMap = {};
  const invalidValueKeyMap = {};
  const missingKeyMap = {};

  issues.forEach((issue) => {
    const key = issue.path.join(".");
    if (issue.code === "invalid_type" && issue.received === "undefined") {
      missingKeyMap[key] = "required";
    } else if (issue.code === "invalid_type") {
      invalidTypeKeyMap[key] = issue.expected;
    } else {
      invalidValueKeyMap[key] = issue.message;
    }
  });

  return { invalidTypeKeyMap, invalidValueKeyMap, missingKeyMap };
};

const extractShape = (schema) => {
  if (!schema) return null;
  if (schema.shape) return schema.shape;
  if (typeof schema._def?.shape === "function") return schema._def.shape();
  if (schema._def?.innerType) return extractShape(schema._def.innerType);
  if (schema._def?.type) return extractShape(schema._def.type);
  return null;
};

const validateDtoIn = (schema, commandCode) => {
  return (req, res, next) => {
    const body = req.body || {};
    const uuAppErrorMap = {};

    const shape = extractShape(schema);
    const allowedKeys = shape ? Object.keys(shape) : [];
    const unsupportedKeyList = Object.keys(body).filter((key) => !allowedKeys.includes(key));

    if (unsupportedKeyList.length) {
      uuAppErrorMap[`${commandCode}/unsupportedKeys`] = {
        type: "warning",
        message: "DtoIn contains unsupported keys.",
        paramMap: { unsupportedKeyList }
      };
    }

    const validationResult = schema.safeParse(body);

    if (!validationResult.success) {
      const paramMap = buildIssueMaps(validationResult.error.issues);
      return res.status(400).json({
        uuAppErrorMap: {
          ...uuAppErrorMap,
          [`${commandCode}/invalidDtoIn`]: {
            type: "error",
            message: "DtoIn is not valid.",
            paramMap
          }
        }
      });
    }

    req.dtoIn = validationResult.data;
    req.uuAppErrorMap = uuAppErrorMap;
    next();
  };
};

module.exports = { validateDtoIn, z };
