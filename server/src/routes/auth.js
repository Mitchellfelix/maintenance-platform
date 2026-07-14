const { Router } = require("express");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const {
  registerSchema,
  loginSchema,
  requestPasswordResetSchema,
  completePasswordResetSchema,
} = require("../schemas/auth");
const { acceptInviteSchema } = require("../schemas/user");
const authService = require("../services/authService");
const { getInviteByToken, acceptInvite } = require("../services/userAdminService");
const {
  requestPasswordReset,
  getPasswordResetByToken,
  completePasswordReset,
} = require("../services/passwordResetService");

const router = Router();

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const result = await authService.register(req.validated);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.validated);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/password-reset", validate(requestPasswordResetSchema), async (req, res, next) => {
  try {
    const result = await requestPasswordReset({
      email: req.validated.email,
      ip: req.ip,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/password-reset/:token", async (req, res, next) => {
  try {
    const preview = await getPasswordResetByToken(req.params.token);
    res.json(preview);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.post(
  "/password-reset/:token",
  validate(completePasswordResetSchema),
  async (req, res, next) => {
    try {
      const result = await completePasswordReset(req.params.token, req.validated);
      res.json(result);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      next(error);
    }
  },
);

router.get("/invites/:token", async (req, res, next) => {
  try {
    const invite = await getInviteByToken(req.params.token);
    res.json(invite);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.post("/invites/:token/accept", validate(acceptInviteSchema), async (req, res, next) => {
  try {
    const result = await acceptInvite(req.params.token, req.validated);
    res.status(201).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.get("/me", auth, async (req, res, next) => {
  try {
    const user = await authService.getUserById(req.user.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
