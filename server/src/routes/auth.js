const { Router } = require("express");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { registerSchema, loginSchema } = require("../schemas/auth");
const authService = require("../services/authService");

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

router.get("/me", auth, async (req, res, next) => {
  try {
    const user = await authService.getUserById(req.user.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
