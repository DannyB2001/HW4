// src/middleware/auth.js

/**
 * allowedProfiles = pole povolených profilů pro daný endpoint
 * např. auth(["user"]), auth(["owner", "member"])
 * Profil se čte z hlavičky x-profile, uživatelská identita z hlavičky x-user-id.
 */
module.exports = function auth(allowedProfiles = []) {
  return (req, res, next) => {
    const profile = req.header("x-profile");
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
    req.userId = userId;
    next();
  };
};
