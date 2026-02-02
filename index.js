const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;
const crypto = require('crypto');

require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const secret = crypto.randomBytes(32).toString('hex');

console.log(secret);

app.use(cors());
app.use(express.json());


const jwt = require('jsonwebtoken');





const uri = "mongodb+srv://lms_user:PAIp8MsjfMCDdouV@cluster0.knekqnq.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const { ObjectId } = require('mongodb');
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    const carccollection=client.db('courseDB').collection('coursecollection');
    const usercollection=client.db('courseDB').collection('usercollection');
    const paymentcollection = client.db('courseDB').collection('paymentcollection');
    await client.db("admin").command({ ping: 1 });
     

    app.get('/courses',async(req,res)=>{
        const technext= await carccollection.find().toArray();
        res.send(technext);
    })

    app.get('/course/:id',async(req,res)=>{
      const {id}= req.params;
      const course = await carccollection.findOne({ _id: new ObjectId(id) });
      res.send(course);
      
    })

   app.post('/sendcourse', async (req, res) => {
  const coursedata = req.body;

  const result = await carccollection.insertOne(coursedata);

  res.send({
    success: true,
    insertedId: result.insertedId
  });
});

app.post('/create-payment-intent',async(req,res)=>{
  const {amount}=req.body;
  try{
    const paymentIntent= await stripe.paymentIntents.create({
      amount,
      currency:'usd',
      payment_method_types:['card'],
    });
    res.json({clientSecret:paymentIntent.client_secret})
  } catch(error){
    res.status(500).json({error:error.message})
  }

})

app.post('/payment-success', async (req, res) => {
  const { course_id, amount, paymentId } = req.body;

  try {
    // ✅ paymentdata object create
    const paymentdata = {
      course_id,
      amount,
      paymentId,
      date: new Date(), // optional: কবে payment হলো track করার জন্য
    };

    // ✅ insert into collection
    const result = await paymentcollection.insertOne(paymentdata);

    console.log('Payment confirmed:', paymentdata);

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving payment:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


app.post('/gettoken',async(req,res)=>{
  const {email} = req.body;

  if(!email) return res.status(400).json({message: "Email required"});

  const user = await usercollection.findOne({email});

   if (!user) return res.status(404).json({ message: "User not found" });

   const token = jwt.sign(
    { userId: user._id, role: user.role},
    secret,
    {expiresIn: "7d"}
   );

   res.json({
    token,
    role:user.role
   });
});

  app.patch("/users/role", async (req, res) => {
  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).json({ message: "Email and role required" });
  }

  const result = await usercollection.updateOne(
    { email: email },
    { $set: { role: role } }
  );

  if (result.modifiedCount === 0) {
    return res.status(404).json({ message: "User not found or role unchanged" });
  }

  res.json({ message: "Role updated successfully" });
});

    app.post('/userrolewithdata',async(req,res)=>{
       const {username,email}= req.body;
     const result = await usercollection.insertOne({
  username,
  email,
  role: "normal_user"
});
     res.send(result);
      

    })

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);





app.post('/painandgain',(req,res)=>{
    const gain = req.body;
    res.send(gain);
})





app.get('/',(req,res)=>{
    res.send("it's happening");
})

app.get('/rockon',(req,res)=>{
    res.send(cards);

})

app.listen(port,()=>{
    console.log(`server is running on port ${port}`)
})