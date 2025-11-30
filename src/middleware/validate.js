// src/middleware/validate.js

module.exports = function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        uuAppErrorMap: {
          "dtoIn/invalidDtoIn": {
            type: "error",
            message: "dtoIn is not valid.",
            paramMap: { issues: result.error.issues }
          }
        }
      });
    }

    // uložíme si validované dtoIn
    req.dtoIn = result.data;
    next();
  };
};
