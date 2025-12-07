// src/middleware/auth.js

module.exports = function auth(req, res, next) {
  const userId = req.header("x-user-id");

  if (!userId) {
    return res.status(401).json({
      uuAppErrorMap: {
        "authentication/invalidIdentity": {
          type: "error",
          message: "Missing x-user-id header.",
          paramMap: {}
        }
      }
    });
  }

  req.user = { id: userId };
  next();
};
