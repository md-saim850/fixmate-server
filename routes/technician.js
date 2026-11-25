import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import { verifyTechnician, verifyToken } from "../middleware/auth.js";
import 'dotenv/config'

const router = express.Router();

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db(process.env.DB_NAME);

const servicesCollection = db.collection("services");

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

export default router;