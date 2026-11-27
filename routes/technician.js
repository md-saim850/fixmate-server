import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import { verifyTechnician, verifyToken } from "../middleware/auth.js";
import 'dotenv/config'

const router = express.Router();

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db(process.env.DB_NAME);

const servicesCollection = db.collection("services");

const allowedTransitions = {
  requested: ["accepted", "rejected"],
  accepted: ["in-progress"],
  "in-progress": ["completed"],
};

const validStatuses = [
  "requested",
  "accepted",
  "in-progress",
  "completed",
  "rejected",
  "cancelled",
];

router.get("/status", verifyToken, verifyTechnician, async (req, res) => {
  try {
    const technicianId = req.user.id;

    if (!ObjectId.isValid(technicianId)) {
      return res.status(400).json({
        message: "Invalid technician ID",
      });
    }

    // Total services created by technician
    const totalServices = await servicesCollection.countDocuments({
      "technician.id": technicianId,
    });

    // Approved services
    const approvalServices = await servicesCollection.countDocuments({
      "technician.id": technicianId,
      approvalStatus: "approved",
    });

    // Pending requests
    const pendingRequests = await servicesCollection.countDocuments({
      "technician.id": technicianId,
      approvalStatus: "pending",
    });

    res.status(200).json({
      totalServices,
      approvalServices,
      pendingRequests,
    });

  } catch (error) {
    console.error("Technician status error:", error);

    res.status(500).json({
      message: "Failed to fetch technician statistics",
    });
  }
});

router.get("/", verifyToken, verifyTechnician, async (req, res) => {
  try {
    if (req.user.role !== "technician") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Technician only.",
      });
    }

    const { status } = req.query;

    const query = {
      "technician.id": req.user.id,
    };

    if (status && status !== "all") {
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking status",
        });
      }

      query.status = status;
    }

    const bookings = await db
      .collection("bookings")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      totalBookings: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get technician bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch technician bookings",
    });
  }
});

router.patch("/:id/status", verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, finalAmount } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const bookingsCollection = db.collection("bookings");

    const booking = await bookingsCollection.findOne({
      _id: new ObjectId(id),
      "technician.id": req.user.id,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const allowedStatuses =
      allowedTransitions[booking.status] || [];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change booking from ${booking.status} to ${status}`,
      });
    }

    const updateData = {
      status,
      updatedAt: new Date(),
    };

    if (status === "completed") {
      const amount = Number(finalAmount);

      if (
        finalAmount === undefined ||
        finalAmount === null ||
        finalAmount === "" ||
        !Number.isFinite(amount) ||
        amount < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid final amount",
        });
      }

      updateData.finalAmount = amount;
    }

    const result = await bookingsCollection.updateOne(
      {
        _id: new ObjectId(id),
        "technician.id": req.user.id,
        status: booking.status,
      },
      {
        $set: updateData,
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(409).json({
        success: false,
        message: "Booking was updated by another request. Please refresh.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Booking ${status} successfully`,
    });
  } catch (error) {
    console.error("Update booking status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update booking status",
    });
  }
  }
);

export default router;