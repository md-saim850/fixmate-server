import { Router } from "express";
import { MongoClient, ObjectId } from "mongodb";

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

router.get("/services", verifyToken, verifyAdmin, async (req, res) => {
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

router.get("/bookings", verifyToken, verifyAdmin, async (req, res) => {
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

router.patch("/users/:userId/role", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const allowedRoles = ["customer", "technician", "admin"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    if (req.user.id === userId) {
      return res.status(403).json({
        success: false,
        message: "You cannot change your own role",
      });
    }

    const result = await db
      .collection('user')
      .updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          role,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
    });
  } catch (error) {
    console.error("Update user role error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update user role",
    });
  }
});

router.patch("/services/:id/approval", verifyToken, verifyAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { approvalStatus } = req.body;

      const allowedStatuses = ["approved", "rejected"];

      if (!allowedStatuses.includes(approvalStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid approval status",
        });
      }

      const service = await db
      .collection("services")
      .findOne({
        _id: new ObjectId(id),
      });

      if (!service) {
        return res.status(404).json({
          success: false,
          message: "Service not found",
        });
      }

      const result = await db
        .collection("services")
        .updateOne({ _id: new ObjectId(id) },
        {
          $set: {
            approvalStatus,
            updatedAt: new Date(),
          },
        }
      );

      if (result.modifiedCount === 0) {
        return res.status(200).json({
          success: true,
          message: "Service approval status is already up to date",
        });
      }

      res.status(200).json({
        success: true,
        message: `Service ${approvalStatus} successfully`,
      });
    } catch (error) {
      console.error("Update service approval error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to update service approval status",
      });
    }
  }
);

export default router;