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
  _profileId: Schema.Types.ObjectId,
  profileName: String,
  mobileNo: String,
  dateOfBirth: Date,
  homeAddress: String,
  email: String,
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
  sharedProfiles: { type: Array, "default": [] }
});

var receivedProfilesSchema = new Schema({
  connectionId: String, //Requesters ID
  receivedProfileId: { type: Array, "default": [] }
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


/*******************************************************************************************************************************/

/*
******************************************************* 
* GLOBALLY DECLARE BODY PARSER 
*******************************************************
*/

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

/*******************************************************************************************************************************/

/*
******************************************************* 
* DEFINE ROUTES
*******************************************************
*/

//GET request handler for index route
app.get("/", (req, res) => res.render("pages/index"));

//POST request handler for register route
app.post("/register", function (req, res) {
  console.log("Registration process has started...");
  if (!req.body) return res.sendStatus(400);

  //Received request body is encrypted
  var registerInfo = req.body;

  //Request body is decrypted
  var bytes = CryptoJS.Rabbit.decrypt(registerInfo, 'my key is 123');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JSON Object
  var regObj = JSON.parse(plaintext);

  console.log(regObj);

  admin.auth().createUser({
    uid: regObj.uuid,
    email: regObj.email,
    password: regObj.password,
    displayName: regObj.fName + " " + regObj.lName
  })
    .then(function (userRecord) {
      // See the UserRecord reference doc for the contents of userRecord.
      console.log("Successfully created new user:", userRecord.displayName); 
      
      //Create new user document
      var user = new User({
        userId: regObj.uuid,
        fName: regObj.fName,
        lName: regObj.lName,
        bio: regObj.bio,
        profilePic: "",
        profiles: [],
        requests: [],
        receivedProfiles: []
      });
      
      //Save created user document
      user.save(function(err) {
          if (err) console.log('Database Error: ' + err);
      }).then(function() {
        console.log("User document has been created successfully!");
      });
      
      res.json("User has been registered and document created successfully");
    })
    .catch(function (error) {
      console.log("Error creating new user:", error);
    });
});

//POST request handler for creating profiles
app.post("/profiles/create", function (req, res) {
  console.log("inside createProfile route");

  if (!req.body)
    return res.sendStatus(400);

    //Received request body that is encrypted
    var profileInfo = req.body;

    //Request body is decrypted
    var bytes = CryptoJS.Rabbit.decrypt(profileInfo, 'my key is 123');

    //Decrypted request body is converted to plain text
    var plaintext = bytes.toString(CryptoJS.enc.Utf8);

    //Request body is parsed to a JSON Object
    var profObj = JSON.parse(plaintext);
    // var profObj = JSON.parse(req.body);

    console.log(profObj);

    //populating a new profile
    var profile = new Profile({
      _profileId: mongoose.Types.ObjectId(),
      profileName: profObj.profileName,
      mobileNo: profObj.mobileNo,
      dateOfBirth: profObj.dateOfBirth,
      homeAddress: profObj.homeAddress,
      email: profObj.email,
      links: {
        facebookURL: profObj.links.facebookURL,
        twitterURL: profObj.links.twitterURL,
        linkedinURL: profObj.links.linkedinURL,
        blogURL: profObj.links.blogURL
      },
      work: {
        companyName: profObj.work.companyName,
        companyWebsite: profObj.work.companyWebsite,
        workAddress: profObj.work.workAddress,
        workEmail: profObj.work.workEmail,
        designation: profObj.work.designation
      }
    });

    console.log(profile);

    //Querying for the relevant user's document and pushing the profie to the profiles feild 
    User.findOne({ userId: profObj.uid }).then(function (record) {
      record.profiles.push(profile);
      record.save();
      console.log("profile saved successfully");
      res.json("successful");
    });
});

//POST request handler for sending profiles
app.post("/profiles/send", function (req, res) {
  console.log("inside sending profiles route");
  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var uidEncripted = req.body;

  //Request body is decrypted
  var bytes = CryptoJS.Rabbit.decrypt(uidEncripted, 'my key is 123');

  //Decrypted request body is converted to plain text
  var uid = bytes.toString(CryptoJS.enc.Utf8);

  //creating json object from mongoose document that contains information of profiles of a particular user
  User.findOne({userId: uid}).lean()
  .populate('profiles', '_profileId profileName mobileNo dateOfBirth homeAddress email links.facebookURL links.twitterURL links.linkedinURL links.blogURL work.companyName work.companyWebsite work.workAddress work.workEmail work.designation')
  .exec(
    function(err, record){
      if (err){
        res.json("Error in retrieving");
        console.log("Error in sending profiles");
      } 
      else{
      console.log(record.profiles);
      //JS object is turned into a JSON Object
      var profiles = JSON.stringify(record.profiles); 
      console.log(profiles);
      res.json(profiles);
      }
});
});

//POST request handler for sending information of a profile
app.post("/profile/send", function (req, res) {
  console.log("inside sending profiles route");
  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var userProfileInfo = req.body;

  //Request body is decrypted
  var bytes = CryptoJS.Rabbit.decrypt(userProfileInfo, 'my key is 123');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JSON Object
  var infoObj = JSON.parse(plaintext);

  //creating json object from mongoose document that contains information of profiles of a particular user
  User.findOne({ userId: infoObj.uid, _profileId: infoObj.profileId }).lean()  
  .populate('profiles', '_profileId profileName mobileNo dateOfBirth homeAddress email links.facebookURL links.twitterURL links.linkedinURL links.blogURL work.companyName work.companyWebsite work.workAddress work.workEmail work.designation')
  .exec(
    function(err, record){
      if (err){
        res.json("Error in retrieving");
        console.log("Error in sending profiles");
      } 
      else{
      console.log(record.profile);
      
      //JS object is turned into a JSON Object
      var profile = JSON.stringify(record.profiles); 
      console.log(profiles);
      res.json(profiles);
      }
});
});

//POST request handler for storing requests
app.post("/device/requests/store", function (req, res) {
  console.log("inside storeRequest route");
  if (!req.body) return res.sendStatus(400);

  var loginInfo = req.body;
  res.sendStatus(200).send(req.body);
  console.log(loginInfo);
});

/*******************************************************************************************************************************/


//creating json object from mongoose document that contains information of profiles of a particular user
User.findOne({ userId: 'konnect123', _profileId: '5ab6390b0ec955000400e67c' }).lean()  
.populate('profiles', '_profileId profileName mobileNo dateOfBirth homeAddress email links.facebookURL links.twitterURL links.linkedinURL links.blogURL work.companyName work.companyWebsite work.workAddress work.workEmail work.designation')
.exec(
  function(err, record){
    if (err){
      res.json("Error in retrieving");
      console.log("Error in sending profiles");
    } 
    else{
    console.log(record.profile);
    
    //JS object is turned into a JSON Object
    var profile = JSON.stringify(record.profiles); 
    console.log(profile);
    //res.json(profiles);
    }
});