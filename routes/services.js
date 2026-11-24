import { Router } from "express";
import { MongoClient, ObjectId } from "mongodb";
import 'dotenv/config'

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

export default router;
