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

router.get("/users", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await db
      .collection('user')
      .find(
        {},
        {
          projection: {
            password: 0,
            hashedPassword: 0,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      totalUsers: users.length,
      users,
    });

  } catch (error) {
    console.error("Get users error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
});

router.get("/services", async (req, res) => {
  try {
    const { approvalStatus } = req.query;

    const filter = {};
    
    if (approvalStatus) {
      filter.approvalStatus = approvalStatus;
    }

    const services = await db
      .collection("services")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    console.log(approvalStatus);

    res.status(200).json({
      success: true,
      totalServices: services.length,
      services,
    });
  } catch (error) {
    console.error("Get admin services error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch services",
    });
  }
});

router.get("/bookings", async (req, res) => {
  try {
    const { status } = req.query;

    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    const bookings = await db
      .collection("bookings")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

      console.log(bookings);
    return res.status(200).json({
      success: true,
      totalBookings: bookings.length,
      bookings,
    });

  } catch (error) {
    console.error("Get all bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
});

export default router;