// src/middleware/auth.js

/**
 * allowedProfiles = pole povolených profilů pro daný endpoint
 * např. auth(["user"]), auth(["owner", "member"])
 */
module.exports = function auth(allowedProfiles = []) {
  return (req, res, next) => {
    const profile = req.header("x-profile"); // simulace identity/profilu

    if (!profile || !allowedProfiles.includes(profile)) {
      return res.status(403).json({
        uuAppErrorMap: {
          "authorization/forbidden": {
            type: "error",
            message: "User profile is not allowed to call this command.",
            paramMap: { profile }
          }
        }
      });
    }

    req.profile = profile;
    next();
  };
};
