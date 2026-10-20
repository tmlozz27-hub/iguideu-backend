import { Router } from "express";
import mongoose from "mongoose";
import { diagnoseGuideBeneficiaryOnboarding } from "../services/airwallex/guide-beneficiary-diagnostic.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/me/bank-status", requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== "guide") {
      return res.status(403).json({
        ok: false,
        error: "GUIDE_ONLY"
      });
    }

    const email = String(req.user?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED"
      });
    }

    const db = mongoose.connection.db;

    if (!db) {
      return res.status(503).json({
        ok: false,
        error: "DATABASE_UNAVAILABLE"
      });
    }

    const guide = await db.collection("guides").findOne(
      { email },
      {
        projection: {
          _id: 1,
            "airwallex.beneficiaryId": 1,
            "airwallex.beneficiaryVerified": 1,
            "airwallex.beneficiaryVerifiedAt": 1,
          "airwallex.onboardingClaimId": 1,
          "airwallex.onboardingCreatedBeneficiaryId": 1
        }
      }
    );

    if (!guide) {
      return res.status(404).json({
        ok: false,
        error: "GUIDE_NOT_FOUND"
      });
    }

    const diagnosis = diagnoseGuideBeneficiaryOnboarding(guide);
    const linked = Boolean(
      String(guide.airwallex?.beneficiaryId || "").trim()
    );

    return res.json({
      ok: true,
      bankStatus: diagnosis.requiresManualReview ? "REVIEW_REQUIRED" : linked ? "LINKED" : "NOT_LINKED",
      onboardingStatus: diagnosis.status,
      requiresManualReview: diagnosis.requiresManualReview,
      retryAllowed: diagnosis.retryAllowed,
      verificationStatus: !linked ? "NOT_LINKED" : guide.airwallex?.beneficiaryVerified === true && guide.airwallex?.beneficiaryVerifiedAt instanceof Date && !Number.isNaN(guide.airwallex.beneficiaryVerifiedAt.getTime()) ? "VERIFIED" : "PENDING_VERIFICATION"
    });

  } catch {
    return res.status(500).json({
      ok: false,
      error: "BANK_STATUS_ERROR"
    });
  }
});

export default router;
