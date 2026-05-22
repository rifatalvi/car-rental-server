const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;


app.use(cors({
    origin: ['http://localhost:3000', 'https://car-rental-platfrom.vercel.app'],
    credentials: true
}));
app.use(express.json());


const client = new MongoClient(process.env.MONGODB_PRIVET_URL, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

let carsCollection, bookingCollection;

async function connectDB() {
    await client.connect();
    const db = client.db('cars-collection-db');
    carsCollection = db.collection("cars");
    bookingCollection = db.collection("booking");
    console.log("✅ Successfully connected to MongoDB!");
}
connectDB().catch(console.dir);

const JWKS = createRemoteJWKSet(new URL(`${process.env.FRONTEND_URL}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ message: 'Unauthorized: Missing Token' });

        const { payload } = await jwtVerify(token, JWKS);
        req.user = payload;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Unauthorized: Invalid Token' });
    }
};


app.get('/', (req, res) => res.send("🚀 Server is live!"));




app.get('/cars', async (req, res) => {
    const { search, type } = req.query;
    let query = {};

    if (search) query.$or = [{ carName: new RegExp(search, 'i') }, { carType: new RegExp(search, 'i') }];
    if (type) query.carType = new RegExp(`^${type}$`, 'i');

    const result = await carsCollection.find(query).toArray();
    res.json(result);
});


app.get('/cars/:id', verifyToken, async (req, res) => {
    const result = await carsCollection.findOne({ _id: new ObjectId(req.params.id) });
    res.json(result);
});


app.post('/cars', async (req, res) => {
    const result = await carsCollection.insertOne(req.body);
    res.json(result);
});


app.patch("/cars/:id", verifyToken, async (req, res) => {
    const result = await carsCollection.updateOne(
        { _id: new ObjectId(req.params.id) }, 
        { $set: req.body }
    );
    res.json(result);
});


app.get('/features/cars', verifyToken, async (req, res) => {
    const result = await carsCollection.find().limit(4).toArray();
    res.json(result);
});


app.get('/users/:userId/cars', async (req, res) => {
    const result = await carsCollection.find({ userId: req.params.userId }).toArray();
    res.json(result);
});


app.delete('/cars/:id', verifyToken, async (req, res) => {
    const result = await carsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json(result);
});


app.post('/bookings/:carId', verifyToken, async (req, res) => {
    try {
        const { carId } = req.params;
        const carObjectId = new ObjectId(carId);

        
        await carsCollection.updateOne(
            { _id: carObjectId },
            { $inc: { bookingCount: 1 }, $set: { lastBookingAt: new Date() } }
        );

      
        const result = await bookingCollection.insertOne({
            ...req.body,
            carId: carObjectId,
            bookingAt: new Date(),
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
});


app.get("/users/:userId/bookings", verifyToken, async (req, res) => {
    const result = await bookingCollection.find({ userId: req.params.userId }).toArray();
    res.json(result);
});



if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => console.log(`🔥 Server listening locally on port ${port}`));
}
module.exports = app;