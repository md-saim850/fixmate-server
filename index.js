import express from "express";
import { MongoClient } from 'mongodb';
import "dotenv/config";
import serviceRoutes from "./routes/services.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;

  } catch (err) {
    console.dir(err);

  }
}

// API routes
app.use("/api/services", serviceRoutes);


app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});