const express = require('express');
const app = express();
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

dotenv.config();

const port = process.env.PORT || 5000;
const uri = process.env.MONGODB_PRIVET_URL;

app.use(cors({
    origin: ['http://localhost:3000', 'https://car-rental-platfrom.vercel.app'],
    credentials: true
}));
app.use(express.json());


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


let db, carsCollection, bookingCollection;

async function connectDB() {
    if (!db) {
        // await client.connect();
        db = client.db('cars-collection-db');
        carsCollection = db.collection("cars");
        bookingCollection = db.collection("booking");
        console.log("Connected directly to MongoDB instance.");
    }
    return { carsCollection, bookingCollection };
}


app.use(async (req, res, next) => {
    try {
        const collections = await connectDB();
        req.carsCollection = collections.carsCollection;
        req.bookingCollection = collections.bookingCollection;
        next();
    } catch (err) {
        console.error("Database connection failure:", err);
        res.status(500).json({ message: "Database connection failed" });
    }
});

const verifYToken = async (req, res, next) => {
    const authorization = req.headers['authorization'];
    const token = authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized: Missing Token' });

    try {
        
       const jwksUrl = `${process.env.FRONTEND_URL}/api/auth/jwks`;

        const JWKS = createRemoteJWKSet(new URL(jwksUrl));
        const { payload } = await jwtVerify(token, JWKS);
        req.user = payload;
        next();
    } catch (error) {
        console.error('Token validation failed:', error);
        return res.status(401).json({ message: 'Unauthorized' });
    }
};



app.get('/', (req, res) => {
    res.send("Hello World! Server is live.");
});

app.get('/hello', (req, res) => {
    res.send({ message: "hello" });
});

app.get('/cars', async (req, res) => {
    const result = await req.carsCollection.find().toArray();
    res.json(result);
});

app.get('/my-added-cars/:userId', async (req, res) => {
    const { userId } = req.params;
    const result = await req.carsCollection.find({ userId: userId }).toArray();
    res.json(result);
});

app.patch('/booking-cars/:carsId', verifYToken, async (req, res) => {
    try {
        const { carsId } = req.params;
        const carsData = req.body;

        if (!ObjectId.isValid(carsId)) {
            return res.status(400).json({ message: 'Invalid Car ID format' });
        }

        const car = await req.carsCollection.findOne({ _id: new ObjectId(carsId) });
        if (!car) {
            return res.status(404).json({ message: 'Car not found' });
        }

        await req.carsCollection.updateOne(
            { _id: new ObjectId(carsId) },
            {
                $inc: { bookingCount: 1 },
                $set: { lastBookingAt: new Date() }
            }
        );

        const result = await req.bookingCollection.insertOne({
            ...carsData,
            carId: new ObjectId(carsId),
            bookingAt: new Date(),
        });

        res.send(result);
    } catch (error) {
        console.error("PATCH Booking Error:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

app.get("/booking-cars/:userId", verifYToken, async (req, res) => {
    const { userId } = req.params;
    const result = await req.bookingCollection.find({ userId: userId }).toArray();
    res.json(result);
});

app.post('/car', async (req, res) => {
    const car = req.body;
    const result = await req.carsCollection.insertOne(car);
    res.json(result);
});

app.get('/feature',verifYToken, async (req, res) => {
    const result = await req.carsCollection.find().limit(4).toArray();
    res.json(result);
});

app.delete('/my-added-cars/:id',verifYToken, async (req, res) => {
    const id = req.params.id;
    const result = await req.carsCollection.deleteOne({ _id: new ObjectId(id) });
    res.json(result);
});

app.get('/search', async (req, res) => {
    try {
        const { search, type } = req.query;
        let queryObj = {};

        if (search) {
            queryObj.$or = [
                { carName: { $regex: search, $options: 'i' } },
                { carType: { $regex: search, $options: 'i' } }
            ];
        }

        if (type) {
            queryObj.carType = { $regex: `^${type}$`, $options: 'i' };
        }

        const result = await req.carsCollection.find(queryObj).toArray();
        res.send(result);
    } catch (error) {
        console.error("Search Error:", error);
        res.status(500).send({ message: "Internal server error" });
    }
});

app.patch("/updated-cars/:id",verifYToken, async (req, res) => {
    const id = req.params.id;
    const updatedCarsData = req.body;
    const result = await req.carsCollection.updateOne(
        { _id: new ObjectId(id) }, 
        { $set: updatedCarsData }
    );
    res.json(result);
});

app.get('/cars/:id', verifYToken, async (req, res) => {
    const { id } = req.params;
    const result = await req.carsCollection.findOne({ _id: new ObjectId(id) });
    res.json(result);
});


if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server listening locally on port ${port}`);
    });
}

module.exports = app; 