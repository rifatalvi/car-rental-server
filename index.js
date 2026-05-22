const express = require('express');
const app = express();
const dontenv = require('dotenv');

const port = process.env.PORT || 5000;
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
dontenv.config()

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
const uri = process.env.MONGODB_PRIVET_URL;
const JWKS = createRemoteJWKSet(
    new URL('http://localhost:3000/api/auth/jwks'))
app.get('/', (req, res) => {
    res.send("hello world!")
});



const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
const verifYToken = async (req, res, next) => {
    const authorization = req.headers['authorization']
    const token = authorization?.split(" ")[1];

    try {
        const JWKS = createRemoteJWKSet(
            new URL('http://localhost:3000/api/auth/jwks')
        )
        const { payload } = await jwtVerify(token, JWKS)
        req.user = payload;
        console.log(req.user);
        next();
    } catch (error) {
        console.error('Token validation failed:', error)
        return res.status(401).json({ message: 'Unauthorize' })
    }
}


async function run() {
    try {

        await client.connect();

        await client.db("admin").command({ ping: 1 });
        const db = client.db('cars-collection-db')
        const carsCollection = db.collection("cars")
        const bookingCollection = db.collection("booking")
        app.get('/hello', (req, res) => {
            res.send({ message: "hello" })
        });

        app.get('/cars', async (req, res) => {
            const result = await carsCollection.find().toArray();
            res.json(result);
        })
        app.get('/my-added-cars/:userId', async (req, res) => {
            const { userId } = req.params;
            const result = await carsCollection.find({ userId: userId }).toArray();
            res.json(result);
        })
        app.patch('/booking-cars/:carsId', verifYToken, async (req, res) => {
            try {
                const { carsId } = req.params;
                const carsData = req.body;


                if (!ObjectId.isValid(carsId)) {
                    return res.status(400).json({ message: 'Invalid Car ID format' });
                }

                const cars = await carsCollection.findOne({
                    _id: new ObjectId(carsId)
                });

                if (!cars) {
                    return res.status(404).json({ message: 'cars are not found' });
                }

                await carsCollection.updateOne(
                    { _id: new ObjectId(carsId) },
                    {
                        $inc: { bookingCount: 1 },
                        $set: { lastBookingAt: new Date() }
                    }
                );


                const result = await bookingCollection.insertOne({
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
            const result = await bookingCollection.find({ userId: userId }).toArray();
            console.log(result);
            res.json(result);
        });
        app.post('/car', async (req, res) => {
            const car = req.body;
            const result = await carsCollection.insertOne(car);
            res.json(result);
        });
        app.get('/feature', async (req, res) => {
            const cars = carsCollection.find().limit(4);
            const result = await cars.toArray();
            res.json(result)
        })

        app.delete('/my-added-cars/:id', async (req, res) => {
            const id = req.params.id;
            const result = await carsCollection.deleteOne({
                _id: new ObjectId(id)
            })
            res.json(result)

        })
        app.get('/search', async (req, res) => {
            try {
                const { search, type } = req.query;
                let queryObj = {};


                if (search) {
                    queryObj.$or = [
                        {
                            carName: { $regex: search, $options: 'i' }
                        },
                        { carType: { $regex: search, $options: 'i' } }
                    ];
                }


                if (type) {
                    queryObj.carType = { $regex: `^${type}$`, $options: 'i' };
                }

                const cursor = carsCollection.find(queryObj);
                const result = await cursor.toArray();

                res.send(result);
            } catch (error) {
                console.error("Search Error:", error);
                res.status(500).send({ message: "Internal server error" });
            }
        });
        app.patch("/updated-cars/:id", async (req, res) => {
            const id = req.params.id;
            const updatedCarsData = req.body;
            const result = await carsCollection.updateOne(
                {
                    _id: new ObjectId(id)
                }, {
                $set: updatedCarsData
            })
            res.json(result)
        })

        app.get('/cars/:id', verifYToken, async (req, res) => {
            const { id } = req.params;
            const result = await carsCollection.findOne({
                _id: new ObjectId(id)
            })
            res.json(result)
        })

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

        // await client.close();
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});