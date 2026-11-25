import express from "express";
import { MongoClient } from "mongodb";
import { verifyCustomer, verifyToken } from "../middleware/auth.js";
import 'dotenv/config'

const router = express.Router();

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db(process.env.DB_NAME);

const bookingCollection = db.collection("bookings");

router.get("/status", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const userId = req.user.id;

    const bookings = await bookingCollection
      .find({ "customer.id": userId })
      .toArray();

    const totalRequests = bookings.length;

    const activeRequests = bookings.filter(
      (booking) =>
        ["in-progress", "accepted"].includes(
          booking.status?.toLowerCase()
        )
    ).length;

    const completedRequests = bookings.filter(
      (booking) =>
        booking.status?.toLowerCase() === "completed"
    ).length;

    res.status(200).json({
      totalRequests,
      activeRequests,
      completedRequests,
    });

  } catch (error) {
    console.error("User status error:", error);

    res.status(500).json({
      message: "Failed to fetch user status",
    });
  }
});

export default router;