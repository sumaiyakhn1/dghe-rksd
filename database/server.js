import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for large Excel files

// MongoDB connection
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;

async function connectDB() {
  try {
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // Choose your database name
    db = client.db("dghe-erp");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

connectDB();

// Auth Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });
  req.userId = "default_user"; // Use a fixed user ID to prevent data loss on token change
  next();
};

// Basic API Status route
app.get('/api/status', (req, res) => {
  res.json({ message: "API is running", dbConnected: !!db });
});

// Create Entity
app.post('/api/entities', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const { name, entityId, session } = req.body;
    const collection = db.collection('entities');
    const newEntity = {
      userId: req.userId,
      name,
      entityId,
      session,
      createdAt: new Date()
    };
    const result = await collection.insertOne(newEntity);
    res.json({ _id: result.insertedId, ...newEntity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch user's entities
app.get('/api/entities', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const collection = db.collection('entities');
    const entities = await collection.find({}).sort({ createdAt: -1 }).toArray();
    res.json(entities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Entity Mapping
app.put('/api/entities/:id/mapping', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const entityId = req.params.id;
    const { mapping, sampleHeaders, valueMappings } = req.body;
    
    const updatePayload = { mapping };
    if (sampleHeaders) {
      updatePayload.sampleHeaders = sampleHeaders;
    }
    if (valueMappings) {
      updatePayload.valueMappings = valueMappings;
    }

    const collection = db.collection('entities');
    const result = await collection.updateOne(
      { _id: new ObjectId(entityId) },
      { $set: updatePayload }
    );
    
    if (result.matchedCount === 0) return res.status(404).json({ error: "Entity not found" });
    res.json({ success: true, message: "Mapping updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Entity
app.delete('/api/entities/:id', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const entityId = req.params.id;

    // Delete the entity
    const entitiesCol = db.collection('entities');
    const result = await entitiesCol.deleteOne({ _id: new ObjectId(entityId) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Entity not found" });
    }

    // Delete all associated files
    const filesCol = db.collection('entity_files');
    await filesCol.deleteMany({ entityObjectId: entityId });

    res.json({ success: true, message: "Entity deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save file and mapping for an entity
app.post('/api/entities/:id/files', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const { fileName, mapping, excelData } = req.body;
    const entityObjectId = req.params.id;

    const collection = db.collection('entity_files');
    const newFile = {
      userId: req.userId,
      entityObjectId,
      fileName,
      mapping,
      excelData,
      pushedRegistrationNumbers: [],
      createdAt: new Date()
    };
    const result = await collection.insertOne(newFile);
    res.json({ success: true, fileId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch files for an entity (excluding excelData to save bandwidth)
app.get('/api/entities/:id/files', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const entityObjectId = req.params.id;
    const collection = db.collection('entity_files');
    const files = await collection.find(
      { entityObjectId },
      { projection: { excelData: 0 } }
    ).sort({ createdAt: -1 }).toArray();
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch a single file by ID (including excelData)
app.get('/api/files/:fileId', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const fileId = req.params.fileId;
    const collection = db.collection('entity_files');
    const file = await collection.findOne({ _id: new ObjectId(fileId) });
    if (!file) return res.status(404).json({ error: "File not found" });
    res.json(file);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a single file by ID
app.delete('/api/files/:fileId', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const fileId = req.params.fileId;
    const collection = db.collection('entity_files');
    const result = await collection.deleteOne({ _id: new ObjectId(fileId) });
    if (result.deletedCount === 0) return res.status(404).json({ error: "File not found or unauthorized" });
    res.json({ message: "File deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark a student as pushed
app.put('/api/files/:fileId/push', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const fileId = req.params.fileId;
    const { regNo } = req.body;
    if (!regNo) return res.status(400).json({ error: "Registration number required" });

    const collection = db.collection('entity_files');
    const result = await collection.updateOne(
      { _id: new ObjectId(fileId) },
      { $addToSet: { pushedRegistrationNumbers: regNo } }
    );
    
    if (result.matchedCount === 0) return res.status(404).json({ error: "File not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
