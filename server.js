/*
******************************************************* 
* IMPORT DEPENDENCIES
*******************************************************
*/

const express = require("express");
const path = require("path");
var CryptoJS = require("crypto-js");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const serviceAccount = require("./admin/konnect-ionic-auth-firebase-adminsdk-s951b-aabc7ba7c0.json");
var cors = require('cors');

/*******************************************************************************************************************************/

/*
******************************************************* 
* INITIALIZE EXPRESS AND FIREBASE ADMIN SDK
*******************************************************
*/

const app = express();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://konnect-ionic-auth.firebaseio.com"
});

/*******************************************************************************************************************************/

/*
******************************************************* 
* DEFINE PATHS
*******************************************************
*/

app.use(express.static(path.join(__dirname, "public"))); //Define path for static assets
app.set("views", path.join(__dirname, "views")); //Define path for views
app.set("view engine", "ejs"); //Define view engine as EJS
app.use(cors());

/*******************************************************************************************************************************/

/*
******************************************************* 
* SET PORT
*******************************************************
*/

const PORT = process.env.PORT || 5000; //Port is assigned at runtime by Heroku or 5000 by default
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

/*******************************************************************************************************************************/

/*
******************************************************* 
* CONNECTION TO DATABASE
*******************************************************
*/

let URI =
  "mongodb://heroku_24qgfjxh:5u7so4mv67fq7ahpjvcpacddgg@ds119489.mlab.com:19489/heroku_24qgfjxh"; //mLab Connection URI
mongoose.connect(URI); //Connecting to mLab Database

/*******************************************************************************************************************************/

/*
******************************************************* 
* DEFINE SCHEMAS AND CREATE MODELS FOR COLLECTIONS
*******************************************************
*/

var Schema = mongoose.Schema;

var profilesSchema = new Schema({
  profileId: String,
  profileName: String,
  mobileNo: String,
  dateOfBirth: Date,
  homeAddress: String,
  links: {
    facebookURL: String,
    twitterURL: String,
    linkedinURL: String,
    blogURL: String
  },
  work: {
    companyName: String,
    companyWebsite: String,
    workAddress: String,
    workEmail: String,
    designation: String
  }
});

var requestsSchema = new Schema({
  requesterUserId: String 
});

var connectedUsersSchema = new Schema({
    connectedUserId: String,
    sharedProfiles: {type : Array , "default" : []}
});

var receivedProfilesSchema = new Schema({
    connectionId: String, //Requesters ID
    receivedProfileId: {type : Array , "default" : []}  
});

var usersSchema = new Schema({
  userId: String,
  fName: String,
  lName: String,
  bio: String,
  profilePic: String,
  profiles: [profilesSchema],
  requests: [requestsSchema],
  connectedUsers: [connectedUsersSchema],
  receivedProfiles: [receivedProfilesSchema]
});

var Profile = mongoose.model("profiles", profilesSchema);
var Request = mongoose.model("requests", requestsSchema);
var ReceivedProfile = mongoose.model("receivedProfiles", receivedProfilesSchema);
var User = mongoose.model("users", usersSchema);
var ConnectedUsers = mongoose.model("connectedUsers", connectedUsersSchema);

//var user1 = new User({
//   userId: "konnect123",
//   fName: "Raneesh",
//   lName: "Gomez",
//   bio: "Bla bla bla",
//   profilePic: "base64",
//   profiles: [],
//   requests: [],
//   receivedProfiles: []
// });

// user1.save(function(err) {
//     if (err) console.log('Database Error: ' + err);
// });

// var profile1 = new Profile({
//   profileId: "profile123",
//   mobileNo: "07777777777",
//   dateOfBirth: new Date,
//   homeAddress: "478/35 aluthmawatha",
//   links: {
//     facebookURL: "facebook",
//     twitterURL: "twitter",
//     linkedinURL: "linkedin",
//     blogURL: "blog"
//   },
//   work: {
//     companyName: "some company",
//     companyWebsite: "www.company.com",
//     workAddress: "23/4 company road, colombo",
//     workEmail: "company@company.com",
//     designation: "companist"
//   }
// });

/*******************************************************************************************************************************/

/*
******************************************************* 
* DEFINE ROUTES
*******************************************************
*/

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));

/*******************************************************************************************************************************/

/*
******************************************************* 
* DEFINE ROUTES
*******************************************************
*/

//GET request handler for index route
app.get("/", (req, res) => res.render("pages/index"));

//Test POST request handler
app.post("/test", function(req, res) {
    res.json("Got your message, Dillon!");
    console.log(req.body);
});

//POST request handler for register route
app.post("/register", function(req, res) {
  console.log("Registration process has started...");
  if (!req.body) return res.sendStatus(400);
  var registerInfo = req.body;

  var bytes  = CryptoJS.AES.decrypt((registerInfo).toString(), 'my key is 123');
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);
  console.log(plaintext);

  // admin.auth().createUser({
  //     uid: plaintext,
  //     email: registerInfo.email,
  //     password: registerInfo.password,
  //     displayName: registerInfo.fName + " " + registerInfo.lName
  //   })
  //   .then(function(userRecord) {
  //     // See the UserRecord reference doc for the contents of userRecord.
  //     console.log("Successfully created new user:", userRecord.displayName);      
  //     res.json(registerInfo);
  //   })
  //   .catch(function(error) {
  //     console.log("Error creating new user:", error);
  //   });   
});

//POST request handler for login button
app.post("/login", function(req, res) {
  console.log("Login is being validated in the server...");
  if (!req.body) return res.sendStatus(400); 

  var uid;
  var displayName;

  admin.auth().verifyIdToken(String(req.body.token)).then(function(decodedToken) {
      uid = decodedToken.uid;
      displayName = decodedToken.displayName;
    })
    .catch(function(error) {
      console.log(error);
      //console.log("Could not resolve Login ID Token from Client!");
  });

  console.log(displayName);
  res.json("Hello!");
});

//POST request handler for storing requests
app.post("/storeRequest", function(req, res) {
    console.log("Storing requests...");
    if (!req.body) return res.sendStatus(400);
    var loginInfo = req.body;
    res.sendStatus(200);
    res.send(req.body);
    console.log(loginInfo);
  });


//POST request handler for creating profiles
app.post("/createprofile", function(req, res) {
    console.log("inside createProfile route");

    var uid = decodedToken.uid;

    if (!req.body){
        return res.sendStatus(400);
    }
    else {
        var uid;
        var displayName;

        admin.auth().verifyIdToken(idToken).then(function(decodedToken) {
            uid = decodedToken.uid;
            displayName = decodedToken.displayName;
        })
        .catch(function(error) {
            console.log("Could not resolve Login ID Token from Client!");
        });

        var profile = new Profile({
            profileId: uid,
            profileName: req.body.profileName,
            mobileNo: req.body.mobileNo,
            dateOfBirth:  req.body.dateOfBirth,
            homeAddress: req.body.homeAddress,
            links: {
            facebookURL: req.body.facebookURL,
            twitterURL: req.body.twitterURL,
            linkedinURL: req.body.linkedinURL,
            blogURL:  req.body.blogURL
            },
            work: {
            companyName: req.body.companyName,
            companyWebsite: req.body.companyWebsite,
            workAddress: req.body.workAddress,
            workEmail: req.body.workEmail,
            designation: req.body.designation
            }
        });
        
        User.findOne({profileId: uid}).then(function(record) {
            record.profiles.push(profile);
            record.save();
            console.log("profile saved successfully");
            res.sendStatus(200).send("success");  
        });        
    }
});

//POST request handler for storing requests
app.post("/storerequest", function(req, res) {
    console.log("inside storeRequest route");
    if (!req.body) return res.sendStatus(400);

    var loginInfo = req.body;
    res.sendStatus(200).send(req.body);
    console.log(loginInfo);
  });

/*******************************************************************************************************************************/
