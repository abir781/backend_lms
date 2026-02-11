const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const crypto = require('crypto');

const axios = require('axios');
const qs = require('querystring');

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
    const quizdatabase = client.db('courseDB').collection('quizcollection');
    const usercollection=client.db('courseDB').collection('usercollection');
    const paymentcollection = client.db('courseDB').collection('paymentcollection');
    const teacherdatabase = client.db('courseDB').collection('teacherdatabase');
    const announcementcollection = client.db('courseDB').collection('announcementcollection');
    const virtualcollection = client.db('courseDB').collection('VirtualClasses');
    
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

    app.get('/quizes',async(req,res)=>{

      const quiznext = await quizdatabase.find().toArray();
      res.send(quiznext);

    })

  app.post('/sendcourse', async (req, res) => {
  const application = req.body; // 🔥 এক লাইনেই সব ঠিক

  const result = await carccollection.insertOne(application);

  res.send({
    success: true,
    insertedId: result.insertedId
  });
});

app.get('/announces', async (req, res) => {
  const email = req.query.email; // 👈 এখান থেকে আসবে

  let query = {};
  if (email) {
    query = { email };
  }

  const announcements = await announcementcollection.find(query).toArray();
  res.send(announcements);
});

app.post('/teachercreate', async(req,res)=>{
  const teacherdata = req.body;

  const application = {
  ...teacherdata,
  status: "pending",      // always backend controlled
  createdAt: new Date()   // timestamp automatically set
}
  const result = await teacherdatabase.insertOne(application);

  res.send({
    success: true,
    insertedId: result.insertedId
  });
});

app.get('/allteachers', async(req,res)=>{
  const allteachers = await teacherdatabase.find().toArray();
  res.send(allteachers);
})

// app.post('/create-payment-intent',async(req,res)=>{
//    const { amount, course_id, useremail } = req.body;
//   try{
//     const paymentIntent= await stripe.paymentIntents.create({
//       amount,
//       currency:'usd',
//       payment_method_types:['card'],
//     });
//     res.json({clientSecret:paymentIntent.client_secret})
//   } catch(error){
//     res.status(500).json({error:error.message})
//   }

// })


app.post('/create-payment-intent', async (req, res) => {
  const { amount, course_id, useremail } = req.body;

  try {
    // 1️⃣ Check if the user is already enrolled
    const user = await usercollection.findOne({ email: useremail });
    const alreadyEnrolled = user?.enrolled?.some(c => c.courseId === course_id);

    if (alreadyEnrolled) {
      return res.status(400).json({ 
        success: false, 
        message: "You are already enrolled in this course" 
      });
    }

    // 2️⃣ Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: { course_id, useremail } // store for later if needed
    });

    // 3️⃣ Return clientSecret to frontend
    res.json({ clientSecret: paymentIntent.client_secret });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});


app.get('/zoom/connect', (req, res) => {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.ZOOM_REDIRECT_URI);

  const authUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
  res.redirect(authUrl); // Teacher will login & authorize
});


app.get('/zoom/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("No authorization code received");

  try {
    // Step 2: Exchange code for access token
    const tokenResponse = await axios.post('https://zoom.us/oauth/token', qs.stringify({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.ZOOM_REDIRECT_URI
    }), {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const accessToken = tokenResponse.data.access_token;
    const refreshToken = tokenResponse.data.refresh_token;

    // Store accessToken + refreshToken in DB linked to teacher account
    // so you can use it later to create meetings
    res.send({
      message: "Zoom account connected successfully",
      accessToken,
      refreshToken
    });
  } catch (err) {
    console.error("Zoom OAuth Error:", err.response?.data || err.message);
    res.status(500).send({ error: "Failed to get access token" });
  }
});

   



app.post('/payment-success', async (req, res) => {
  const { course_id, amount, paymentId, useremail, course } = req.body;

  try {

    // ✅ prevent duplicate payment save
    const existingPayment = await paymentcollection.findOne({
      paymentId: paymentId,
    });

    if (existingPayment) {
      return res.json({ success: true, message: "Already processed" });
    }

    // ✅ save payment
    const paymentdata = {
      course_id,
      amount,
      paymentId,
      useremail,
      title: course,
      date: new Date(),
    };

    await paymentcollection.insertOne(paymentdata);

    // ✅ update user -> role + enrolled course
    await usercollection.updateOne(
      { email: useremail },
      {
        $set: { role: "student" },
        $push: {
          enrolled: {
            courseId: course_id,
            title: course,
            enrolledAt: new Date(),
          },
        },
      }
    );

    res.json({ success: true });

  } catch (error) {
    console.error("Payment Success Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post('/annoucements',async(req,res)=>{
   const {text,email}= req.body;

     const announce = {
 
  announcement:text,  
  email:email,    // always backend controlled
   // timestamp automatically set
}
    const result = await announcementcollection.insertOne(announce);

    res.json({ message: "announcement updated successfully" });
})




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

app.patch("/admin/teacher/:id/status", async(req,res)=>{
  const {id} = req.params;
  const {status}= req.body;
  const {email}=req.body;

  console.log(req.body);

    if (!["Approved", "Rejected"].includes(status)) {
    return res.status(400).send({ success: false, message: "Invalid status" });
  }

  const result = await teacherdatabase.updateOne(
     { _id: new ObjectId(id) },
    { $set: { status } }

  );

  

  if(status==="Approved"){
    const result2 = await usercollection.updateOne(
      { email: email },   // find by email
      { $set: { role: "teacher" } }
    );
  }

    res.send({
    success: result.modifiedCount > 0
  });


})

app.post("/api/liveclasses", async (req, res) => {
  try {
    const { courseId, title, startTime, duration, createdBy } = req.body;

    if (!courseId || !title || !startTime || !duration || !createdBy) {
      return res.status(400).json({ message: "All fields required" });
    }

    // Validate ObjectId
    if (!ObjectId.isValid(courseId) || !ObjectId.isValid(createdBy)) {
      return res.status(400).json({ message: "Invalid courseId or createdBy" });
    }

    // Validate date
    const startDate = new Date(startTime);
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ message: "Invalid startTime" });
    }

    const liveClassDoc = {
      courseId: new ObjectId(courseId),
      title,
      startTime: startDate,
      duration: Number(duration),
      status: "scheduled",
      createdBy: new ObjectId(createdBy),
      meetingProvider: "",
      meetingId: "",
      joinUrl: "",
      recordingUrl: "",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await virtualcollection.insertOne(liveClassDoc);
    res.status(201).json({ message: "LiveClass created", id: result.insertedId });

  } catch (err) {
    console.error("LiveClass API Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


app.get("/api/liveclasses", async (req, res) => {
  try {
    const liveClasses = await virtualcollection
      .find({})
      .sort({ startTime: -1 }) // latest first
      .toArray();

    res.status(200).json(liveClasses);
  } catch (err) {
    console.error("Get LiveClasses Error:", err);
    res.status(500).json({ message: "Server error" });
  }
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

    app.get('/allusers',async(req,res)=>{

       const alluser = await usercollection.find().toArray();
       res.send(alluser);

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