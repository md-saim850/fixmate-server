import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import { verifyToken } from "../middleware/auth.js";
import 'dotenv/config'

const router = express.Router();

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db(process.env.DB_NAME);

router.get("/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    const user = await db.collection("user").findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get profile error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
});

router.patch("/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    const { name, phone, area, bio, avatar } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    const updateData = {
      name: name.trim(),
      phone: typeof phone === "string" ? phone.trim() : "",
      area: typeof area === "string" ? area.trim() : "",
      bio: typeof bio === "string" ? bio.trim() : "",
      avatar: typeof avatar === "string" ? avatar.trim() : "",
      updatedAt: new Date(),
    };

    const result = await db.collection("user").updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updatedUser = await db.collection("user").findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
});

export default router;