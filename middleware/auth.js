import { createRemoteJWKSet, jwtVerify } from "jose";
import { MongoClient } from "mongodb";
import 'dotenv/config'
import { ObjectId } from "mongodb";

const AUTH_URL = process.env.BETTER_AUTH_URL;

const JWKS = createRemoteJWKSet(
  new URL(`${AUTH_URL}/api/auth/jwks`)
);

async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Please login first",
      });
    }

    const token = authHeader.split(" ")[1]

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: AUTH_URL,
      audience: AUTH_URL,
      algorithms: ["EdDSA"],
    });

    const userId = payload.sub;

    if (!userId) {
      return res.status(401).json({
        message: "Invalid user token",
      });
    }

    const client = new MongoClient(process.env.MONGODB_URI);
    const db = client.db(process.env.DB_NAME);
      
    const user = await db.collection("user").findOne({
      _id: new ObjectId(userId),
    })

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    const {...userData } = user;

    req.user = {  
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      area: user.area,
      bio: user.bio,
      avatar: user.avatar,
    };

    next();

  } catch (error) {
    console.error("Token verification failed:", error.message);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

function allowRole(requiredRole) {
  return (req, res, next) => {
    if (req.user?.role !== requiredRole) {
      return res.status(403).json({
        message: "You don't have permission",
      });
    }

    next();
  };
}

export { verifyToken, allowRole };

export const verifyCustomer = allowRole("customer");
export const verifyTechnician = allowRole("technician");
export const verifyAdmin = allowRole("admin");