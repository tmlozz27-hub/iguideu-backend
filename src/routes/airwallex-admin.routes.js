import { recoverAirwallexBatchAdmin } from "../services/airwallex/batch-recovery-admin.js";
import { recoverAirwallexGuideOnboarding } from "../services/airwallex/guide-onboarding-recovery.js";
import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { requirePayoutAdmin } from "../middleware/payout-admin.js";
import { submitBeneficiaryApprovalReview } from "../services/airwallex/beneficiary-approval-submit.js";

const router = Router();

router.post(
  "/beneficiary-review",
  requireAuth,
  requirePayoutAdmin,
  async (req, res) => {
    try {
      const result = await submitBeneficiaryApprovalReview(
        mongoose.connection.db,
        {
          guideId: req.body?.guideId,
          beneficiaryId: req.body?.beneficiaryId,
          evidenceReference: req.body?.evidenceReference,
          reviewedBy: req.user.email
        }
      );

      return res.status(201).json({
        ok: true,
        ...result
      });
    } catch (error) {
      if (
        error.message === "AIRWALLEX_APPROVAL_AUDIT_DATA_REQUIRED" ||
        error.message === "AIRWALLEX_BENEFICIARY_REVIEW_DATA_REQUIRED"
      ) {
        return res.status(400).json({
          ok: false,
          error: "INVALID_BENEFICIARY_REVIEW"
        });
      }

      return res.status(500).json({
        ok: false,
        error: "BENEFICIARY_REVIEW_FAILED"
      });
    }
  }
);

router.post(
  "/recover-guide-onboarding",
  requireAuth,
  requirePayoutAdmin,
  async (req, res) => {
    try {
      const result = await recoverAirwallexGuideOnboarding(
        mongoose.connection.db,
        req.body?.guideId,
        {
          evidenceReference: req.body?.evidenceReference,
          reviewedBy: req.user.email
        }
      );

      return res.status(200).json({
        ok: true,
        ...result
      });
    } catch (error) {
      console.error("AIRWALLEX_ONBOARDING_RECOVERY_ERROR", error.message);

      return res.status(409).json({
        ok: false,
        error: "AIRWALLEX_ONBOARDING_RECOVERY_REVIEW_REQUIRED"
      });
    }
  }
);
router.post(
  "/recover-batch-transfer",
  requireAuth,
  requirePayoutAdmin,
  async (req, res) => {
    try {
      const result = await recoverAirwallexBatchAdmin({
        batchId: req.body?.batchId,
        transferId: req.body?.transferId,
        evidenceReference: req.body?.evidenceReference,
        reviewedBy: req.user.email
      });

      return res.status(200).json({ ok: true, ...result });
    } catch (error) {
      console.error("AIRWALLEX_BATCH_RECOVERY_ERROR", error.message);

      return res.status(409).json({
        ok: false,
        error: "AIRWALLEX_BATCH_RECOVERY_REVIEW_REQUIRED"
      });
    }
  }
);
export default router;
