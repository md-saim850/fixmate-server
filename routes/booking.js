import { Router } from "express";
import { MongoClient, ObjectId } from "mongodb";

import {
  verifyToken,
  verifyCustomer,
  verifyTechnician,
} from "../middleware/auth.js";

const router = Router();
const active = ["requested", "accepted", "in-progress"];

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db(process.env.DB_NAME);

router.get("/my", verifyToken, async (req, res) => {
  const bookings = db
    .collection("bookings")
    .find({ customerEmail: req.user.email })
    .find()
    .sort({ createdAt: -1 })
    .toArray();
  res.json({ bookings });
});

router.post("/", async (req, res) => {
  console.log(req.user);
  try {
    const { serviceId, address, serviceDate, problemDescription } = req.body;

    if (!req.user) {
      return res.status(401).json({
        message: "Please login to book a service.",
      });
    }

    if (!ObjectId.isValid(serviceId) || !address?.trim() || !serviceDate || String(problemDescription ?? "").trim().length < 20) {
      return res.status(400).json({
        message: "Please complete all repair request fields.",
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

      technicianName: service.technicianName,
      technicianEmail: service.technicianEmail,

      // customerName: req.user.name,
      // customerEmail: req.user.email,
      // customerPhone: req.user.phone ?? "",

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

// router.patch("/:id/cancel", verifyToken, verifyCustomer, async (req, res) => {
//   if (!ObjectId.isValid(req.params.id))
//     return res.status(404).json({ message: "Booking not found" });
//   const result = await getDb()
//     .collection("bookings")
//     .updateOne(
//       {
//         _id: new ObjectId(req.params.id),
//         customerEmail: req.user!.email,
//         status: "requested",
//       },
//       { $set: { status: "cancelled", updatedAt: new Date() } },
//     );
//   if (!result.modifiedCount)
//     return res
//       .status(409)
//       .json({ message: "Only requested bookings can be cancelled" });
//   res.json({ success: true });
// });

// router.get("/technician", verifyToken, verifyTechnician, async (req, res) => {
//   const bookings = await getDb()
//     .collection("bookings")
//     .find({ technicianEmail: req.user!.email })
//     .sort({ createdAt: -1 })
//     .toArray();
//   res.json({ bookings });
// });

// router.patch("/:id/status", verifyToken, verifyTechnician, async (req, res) => {
//   if (!ObjectId.isValid(req.params.id))
//     return res.status(404).json({ message: "Booking not found" });
//   const { status, finalAmount } = req.body;
//   const transitions: Record<string, string> = {
//     requested: "accepted",
//     accepted: "in-progress",
//     "in-progress": "completed",
//   };
//   if (!["accepted", "rejected", "in-progress", "completed"].includes(status))
//     return res.status(400).json({ message: "Invalid next status" });
//   const db = getDb();
//   const booking = await db
//     .collection("bookings")
//     .findOne({
//       _id: new ObjectId(req.params.id),
//       technicianEmail: req.user!.email,
//     });
//   if (!booking) return res.status(404).json({ message: "Booking not found" });
//   const valid =
//     status === "rejected"
//       ? booking.status === "requested"
//       : transitions[booking.status as string] === status;
//   if (!valid)
//     return res.status(409).json({ message: "Invalid job status transition" });
//   if (
//     status === "completed" &&
//     (!Number.isFinite(finalAmount) || finalAmount <= 0)
//   )
//     return res
//       .status(400)
//       .json({ message: "Final amount must be greater than zero" });
//   await db
//     .collection("bookings")
//     .updateOne(
//       {
//         _id: booking._id,
//         technicianEmail: req.user!.email,
//         status: booking.status,
//       },
//       {
//         $set: {
//           status,
//           ...(status === "completed" ? { finalAmount } : {}),
//           updatedAt: new Date(),
//         },
//       },
//     );
// });

export default router;
