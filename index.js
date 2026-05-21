const express = require('express');
const app = express();
const dontenv = require('dotenv');

const port = process.env.PORT || 5000;
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
dontenv.config()
app.use(cors())
app.use(express.json())
const uri = process.env.MONGODB_PRIVET_URL;
  const JWKS = createRemoteJWKSet(
      new URL('http://localhost:3000/api/auth/jwks'))
app.get('/', (req, res) => {
    res.send("hello world!")
});


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
const verifYToken = async (req, res,next)=>{
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
    return res.status(401).json({message: 'Unauthorize'})
  }
}


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        const db = client.db('cars-collection-db')
        const carsCollection = db.collection("cars")
        const bookingCollection = db.collection("booking")
        app.get('/hello', (req, res) => {
            res.send({massege:"hello"})
        });
         
        app.get('/cars',async (req,res)=>{
            const result= await carsCollection.find().toArray();
            res.json(result);  
        })
        app.patch('/cars/:carsId', async (req, res)=>{
            const {carsId} =req.params;
            const carsData = req.body;
            const cars = await carsCollection.findOne({
                _id : new ObjectId(carsId)
            });
            if(!cars){
                return res.status(404).json({message: 'cars are not found'})
            }
            await carsCollection.updateOne(
                {
                _id : new ObjectId(carsId)
            },{
                $inc:{bookingCount :1},
                $set:{
                    lastBookingAt: new Date(),
                }
            }
            )
        })
        app.post('/car', async(req , res)=>{
            const car = req.body;
            const result = await carsCollection.insertOne(car);
            res.json(result);
        });
        app.get('/feature',async ( req,res)=>{
            const cars =carsCollection.find().limit(4);
            const result = await  cars.toArray();
            res.json(result)
        })
        app.get('/cars/:id',verifYToken, async (req,res)=>{
            const {id} = req.params;
               const result =  await carsCollection.findOne({
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