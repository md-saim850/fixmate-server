import { Router } from "express";
import { MongoClient } from "mongodb";

import {
  verifyToken,
  verifyAdmin,
} from "../middleware/auth.js";

const router = Router();

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db(process.env.DB_NAME);


router.get("/status", verifyToken, verifyAdmin, async(req, res) => {
  try {
    const [totalUsers, totalTechnicians, pendingServices,] = await Promise.all([
      db.collection('user').countDocuments(),
      db.collection('user').countDocuments({role: "technician",}),
      db.collection('services').countDocuments({approvalStatus: "pending",}),
    ]);

    return res.status(200).json({
      success: true,
      status: {
        totalUsers,
        totalTechnicians,
        pendingServices,
      },
    });

  } catch (error) {
    console.error("Admin stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin statistics",
    });
  }
})

export default router;