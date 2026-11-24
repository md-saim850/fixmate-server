import { Router } from "express";
import { MongoClient, ObjectId } from "mongodb";
import 'dotenv/config'
import { verifyTechnician, verifyToken } from "../middleware/auth.js";

const router = Router();

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db(process.env.DB_NAME);

const allowedCategories = [
  "Smartphone",
  "Laptop & PC",
  "AC",
  "Refrigerator",
  "TV",
  "Washing Machine",
  "Electrical",
];

router.get("/", async (req, res) => { 
  const { q, category, mode, sort = "newest", limit = "60" } = req.query;

  const filter = {
    approvalStatus: "approved",
    isAvailable: true,
  };

  if (category && allowedCategories.includes(String(category))){
    filter.category = String(category);
  }
  if (mode) filter.serviceMode = String(mode);
  if (q) filter.$text = { $search: String(q) };

  const sortOption =
    sort === "price-asc"
      ? { basePrice: 1}
      : sort === "price-desc"
        ? { basePrice: -1 }
        : { createdAt: -1 };

  const services = await db
    .collection("services")
    .find(filter)
    .sort(sortOption)
    .limit(Math.min(Math.max(Number(limit) || 60, 1), 100))
    .toArray();

  res.json({ services });
});

router.get("/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)){
    return res.status(404).json({ message: "Service not found" });
  }

  const service = await db
    .collection("services")
    .findOne({
      _id: new ObjectId(req.params.id),
      approvalStatus: "approved",
      isAvailable: true,
    });

  if (!service) return res.status(404).json({ message: "Service not found" });
  res.json({ service });
});

router.post("/", verifyToken, verifyTechnician, async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      basePrice,
      estimatedDuration,
      serviceMode,
      image,
    } = req.body;

    // Validate required fields
    if (!title || !category || !description || basePrice === undefined || !estimatedDuration || !serviceMode) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    // Validate price
    const price = Number(basePrice);

    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Base price must be a positive number",
      });
    }

    // Validate service mode
    const allowedModes = ["home-visit", "shop-drop-off", "online"];

    if (!allowedModes.includes(serviceMode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service mode",
      });
    }

    // Validate images
    if (!Array.isArray(image) || !image.every((image) => typeof image === "string")) {
      return res.status(400).json({
        success: false,
        message: "Image must be an array of strings",
      });
    }

    const client = new MongoClient(process.env.MONGODB_URI);
    const db = client.db(process.env.DB_NAME);

    const serviceData = {
      title: title.trim(),
      category: category.trim(),
      description: description.trim(),
      basePrice: price,
      estimatedDuration: estimatedDuration.trim(),
      serviceMode,
      image,
      technician: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
      },
      isAvailable: req.body.isAvailable ?? true,
      approvalStatus: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("services").insertOne(serviceData);

    res.status(201).json({
      success: true,
      message: "Service created successfully",
      service: {
        _id: result.insertedId,
        ...serviceData,
      },
    });

  } catch (error) {
      console.error("Create service error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to create service",
      });
    }
  }
);

export default router;
