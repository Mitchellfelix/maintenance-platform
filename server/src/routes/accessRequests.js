const express = require("express");
const validate = require("../middleware/validate");
const { anyAuth, accessRequestsRead, accessRequestsReview } = require("../middleware/routeGuards");
const { hasPermission } = require("../lib/permissions");
const {
  createAccessRequestSchema,
  reviewAccessRequestSchema,
  approveAccessRequestSchema,
} = require("../schemas/accessRequest");
const {
  createAccessRequest,
  listMyAccessRequests,
  listAccessRequests,
  getAccessRequestById,
  cancelAccessRequest,
  approveAccessRequest,
  rejectAccessRequest,
} = require("../services/accessRequestService");

const router = express.Router();

router.post("/", ...anyAuth, validate(createAccessRequestSchema), async (req, res, next) => {
  try {
    const request = await createAccessRequest(req.user, req.validated);
    res.status(201).json(request);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.get("/mine", ...anyAuth, async (req, res, next) => {
  try {
    const requests = await listMyAccessRequests(req.user.id);
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

router.get("/", ...accessRequestsRead, async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const requests = await listAccessRequests({ status });
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", ...anyAuth, async (req, res, next) => {
  try {
    const request = await getAccessRequestById(req.params.id);
    if (!request) return res.status(404).json({ error: "Access request not found" });

    const isOwner = request.requesterId === req.user.id;
    const canReview = hasPermission(req.user.role, "access-requests:read");
    if (!isOwner && !canReview) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json(request);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/cancel", ...anyAuth, async (req, res, next) => {
  try {
    const request = await cancelAccessRequest(req.user, req.params.id);
    res.json(request);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.patch("/:id/approve", ...accessRequestsReview, validate(approveAccessRequestSchema), async (req, res, next) => {
  try {
    const request = await approveAccessRequest(req.user, req.params.id, req.validated);
    res.json(request);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.patch("/:id/reject", ...accessRequestsReview, validate(reviewAccessRequestSchema), async (req, res, next) => {
  try {
    const request = await rejectAccessRequest(req.user, req.params.id, req.validated.reviewNote);
    res.json(request);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

module.exports = router;
