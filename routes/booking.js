import { Router } from "express";
import { MongoClient, ObjectId } from "mongodb";

import {
  verifyToken,
  verifyCustomer,
} from "../middleware/auth.js";

const router = Router();
const active = ["requested", "accepted", "in-progress"];

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db(process.env.DB_NAME);

router.get("/my", verifyToken, verifyCustomer, async (req, res) => {
  const bookings = await db
    .collection("bookings")
    .find({ "customer.id": req.user.id })
    .sort({ createdAt: -1 })
    .toArray();
  res.json({ bookings });
});

router.post("/", verifyToken, verifyCustomer, async (req, res) => {

  try {
    const { serviceId, address, serviceDate, problemDescription } = req.body;

    if (!req.user) {
      return res.status(401).json({
        message: "Please login to book a service.",
      });
    };

    if (!ObjectId.isValid(serviceId) || !address?.trim() || !serviceDate || String(problemDescription ?? "").trim().length < 20) {
      return res.status(400).json({
        message: "Please complete all fields.",
      });
    }

    const bookingDate = new Date(serviceDate);

    if (
      Number.isNaN(bookingDate.getTime()) ||
      bookingDate < new Date(new Date().setHours(0, 0, 0, 0))
    ) {
      return res.status(400).json({
        message: "Please select a valid future service date.",
      });
    }

    const service = await db.collection("services").findOne({
      _id: new ObjectId(serviceId),
      approvalStatus: "approved",
      isAvailable: true,
    });

    if (!service) {
      return res.status(404).json({
        message: "Service is unavailable.",
      });
    }

    if (service.technicianEmail === req.user.email) {
      return res.status(403).json({
        message: "You cannot request your own service.",
      });
    }

    const active = ["requested", "approved"];

    const duplicate = await db.collection("bookings").findOne({
      serviceId,
      customerEmail: req.user.email,
      status: { $in: active },
    });

    if (duplicate) {
      return res.status(409).json({
        message: "You already have an active request for this service.",
      });
    }

    const booking = {
      serviceId,
      serviceTitle: service.title,
      serviceImage: service.image ?? "",
      category: service.category,
      basePrice: service.basePrice,
      technician: service.technician,
      customer: req.user,
      address: address.trim(),
      serviceDate: bookingDate,
      problemDescription: problemDescription.trim(),
      status: "requested",
      finalAmount: service.basePrice,
      paymentStatus: "unpaid",
      createdAt: new Date(),
    };

    const result = await db.collection("bookings").insertOne(booking);

    return res.status(201).json({
      success: true,
      message: "Booking request submitted successfully.",
      bookingId: result.insertedId,
    });

  } catch (error) {
    console.error("Booking creation error:", error);

    return res.status(500).json({
      message: "Internal server error.",
    });
  }
});

router.get("/:id", verifyToken, verifyCustomer, async(req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const booking = await db.collection("bookings").findOne({
      _id: new ObjectId(id),
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Get booking error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get booking",
    });
  }
})

router.delete("/:id", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    // Find and delete booking
    const result = await db
      .collection("bookings")
      .deleteOne({
        _id: new ObjectId(id),
      });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking deleted successfully",
    });

  } catch (error) {
    console.error("Delete booking error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete booking",
    });
  }
});

export default router;
