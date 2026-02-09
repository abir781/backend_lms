const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
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
    const quizdatabase = client.db('courseDB').collection('quizcollection');
    const usercollection=client.db('courseDB').collection('usercollection');
    const paymentcollection = client.db('courseDB').collection('paymentcollection');
    const teacherdatabase = client.db('courseDB').collection('teacherdatabase');
    const announcementcollection = client.db('courseDB').collection('announcementcollection');
    
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


// app.post('/payment-success', async (req, res) => {
//   const { course_id, amount, paymentId,useremail,coursetitle } = req.body;

//   try {
//     // ✅ paymentdata object create
//     const paymentdata = {
      
//       amount,
//       useremail,

//       paymentId,

   
//       date: new Date(), // optional: কবে payment হলো track করার জন্য
//     };

//     // ✅ insert into collection
//     const result = await paymentcollection.insertOne(paymentdata);

//   const updateResult = await usercollection.updateOne(
//   { email: useremail },
//   {
//     $set: { role: "student" },
//     $push: {
//       enrolled: {
//         courseId: id,
//         title: course.title,
//         enrolledAt: new Date()
//       }
//     }
//   }
// );


  

//     console.log('Payment confirmed:', paymentdata);



//     res.json({ success: true });
//   } catch (err) {
//     console.error('Error saving payment:', err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// });

// app.post('/payment-success', async (req, res) => {
//   const { course_id, amount, paymentId, useremail, coursetitle } = req.body;

//   try {

//     const paymentdata = {
//       course_id,
//       amount,
//       useremail,
//       paymentId,
//       date: new Date(),
//     };

//     await paymentcollection.insertOne(paymentdata);

//     await usercollection.updateOne(
//       { email: useremail },
//       {
//         $set: { role: "student" },
//         $push: {
//           enrolled: {
//             courseId: course_id,
//             title: coursetitle,
//             enrolledAt: new Date()
//           }
//         }
//       }
//     );

//     res.json({ success: true });

//   } catch (err) {
//     console.error('Error saving payment:', err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// });


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