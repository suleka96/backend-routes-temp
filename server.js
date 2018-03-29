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

var connectedUsersSchema = new Schema({
  connectedUserId: String,
  sharedProfiles: { type: Array, "default": [] }
});

var receivedProfilesSchema = new Schema({
  connectionId: String, //Requesters ID
  receivedProfileId: { type: Array, "default": [] }
});

var requestsSchema = new Schema({
  requesterId: String
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
var ReceivedProfile = mongoose.model("receivedProfiles", receivedProfilesSchema);
var User = mongoose.model("users", usersSchema);
var ConnectedUsers = mongoose.model("connectedUsers", connectedUsersSchema);
var Request = mongoose.model("requests", requestsSchema);


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
      console.log("Successfully created new user:", userRecord.displayName); zzz

      //Create new user document
      var user = new User({
        userId: regObj.uuid,
        fName: regObj.fName,
        lName: regObj.lName,
        bio: regObj.bio,
        profilePic: "",
        profiles: [],
        requests: [],
        connectedUsers: [],
        receivedProfiles: []
      });

      //Save created user document
      user.save(function (err) {
        if (err) console.log('Database Error: ' + err);
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
  // addProfile(profObj);

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

//POST request handler for editing profiles
app.post("/profile/edit", function (req, res) {

  if (!req.body)
    return res.sendStatus(400);

  //Received request body that is encrypted
  var editProfileInfo = req.body;

  //Request body is decrypted
  var bytes = CryptoJS.Rabbit.decrypt(editProfileInfo, 'my key is 123');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JSON Object
  var editProfObj = JSON.parse(plaintext);

  console.log(editProfObj);

  User.update({ "profiles._profileId": editProfObj._profileId }, { "profiles.$": editProfObj }, function (err, raw) {
    if (err) {
      console.log(err);
    }
    else {
      console.log(raw);
    }
  });
});

//POST request handler for deleting profiles
app.post("/profile/delete", function (req, res) {

  console.log("Inside delete profile route");

  if (!req.body)
    return res.sendStatus(400);

  //Received request body that is encrypted
  var delProfileInfo = req.body;

  //Request body is decrypted
  var bytes = CryptoJS.Rabbit.decrypt(delProfileInfo, 'my key is 123');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JSON Object
  var delProfObj = JSON.parse(plaintext);

  User.update(
    { userId: delProfObj.uid },
    { $pull: { profiles: { _profileId: delProfObj._profileId } } },
    { safe: true },
    function removeConnectionsCB(err, obj) {
      if (err) {
        console.log(err);
      }
      else {
        console.log(obj);
        res.json("Success");
      }

    });
});

//POST request handler for sending profiles
app.post("/profiles/send", function (req, res) {
  console.log("inside sending profile ID route");
  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var uidEncripted = req.body;

  //Request body is decrypted
  var bytes = CryptoJS.Rabbit.decrypt(uidEncripted, 'my key is 123');

  //Decrypted request body is converted to plain text
  var uid = bytes.toString(CryptoJS.enc.Utf8);

  //creating json object from mongoose document that contains information of profiles of a particular user
  User.findOne({ userId: uid })
    .populate('_profileId profileName')
    .lean().exec(
    function (err, record) {
      if (err) {
        res.json("Error in retrieving");
        console.log("Error in sending profiles");
      }
      else {
        //console.log(record.profiles);

        //JS object is turned into a JSON Object
        var profiles = JSON.stringify(record.profiles);
        console.log(profiles);
        //var gg = JSON.parse(profiles); 
        //console.log(gg);

        res.json(profiles);
      }
    });
});

//POST request handler for sending information of a profile
app.post("/profile/send", function (req, res) {
  console.log("inside sending individual profiles route");
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
  User.findOne({ "profiles._profileId": infoObj._profileId }, { "profiles.$": 1, "_id": 0 }, function (err, profile) {
    if (err) {
      console.log(err);
    }
    else {
      var profileSent = JSON.stringify(profile);
      console.log(profileSent);
      res.json(profileSent);

    }
  });
});

//POST request handler for returning public profile of requests
app.post("/device/requests/return", function (req, res) {
  console.log("inside returnRequest route");
  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var userRequest = req.body;

  //Request body is decrypted
  var bytes = CryptoJS.Rabbit.decrypt(userRequest, 'my key is 123');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JSON Object
  var requestInfoObj = JSON.parse(plaintext);

  User.findOne({ "userId": requestInfoObj.uid }, { "requests": 1, "_id": 0 }).then(function (result) {

    console.log(result);

    var myObj = JSON.stringify(result);
    var parsedObj = JSON.parse(myObj);

    var array = [];

    for (var i = 0; i < parsedObj.requests.length; i++) {

      console.log("JS value " + i + ": " + parsedObj.requests[i].requesterId);

      User.findOne({ userId: parsedObj.requests[i].requesterId }).then(function (record) {
        console.log("profile retrieved successfully");
        array.push({ userId: record.userId, fName: record.fName, lName: record.lName, bio: record.bio });
        console.log("resultttttttttttt" + JSON.stringify(array));
      }).then(function () {
        if (Object.keys(array).length == parsedObj.requests.length) {
          console.log("Requesters Public Profiles: " + JSON.stringify(array));
          res.json(array);
        }
      });
    }
  });
});

//POST request handler for returning recieved connections basic profile
app.post("/device/connections/return", function (req, res) {
  console.log("inside return connections route");
  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var userConnections = req.body;

  //Request body is decrypted
  var bytes = CryptoJS.Rabbit.decrypt(userConnections, 'my key is 123');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JSON Object
  var requestConnectionObj = JSON.parse(plaintext);

  User.findOne({ "userId": requestConnectionObj.uid }, { "connectedUsers": 1, "_id": 0 }).then(function (result) {
    console.log(result);

    var myObj = JSON.stringify(result);
    var parsedObj = JSON.parse(myObj);

    var array = [];

    for (var i = 0; i < parsedObj.connectedUsers.length; i++) {

      console.log("JS value " + i + ": " + parsedObj.connectedUsers[i].connectedUserId);

      User.findOne({ userId: parsedObj.requests[i].connectedUserId }).then(function (record) {
        array.push({ userId: record.userId, fName: record.fName, lName: record.lName, bio: record.bio });
        console.log("Connected User Public Profiles Iteration" + i + ": " + JSON.stringify(array));
      }).then(function () {
        if (Object.keys(array).length == parsedObj.requests.length) {
          console.log("Connected Users Public Profiles: " + JSON.stringify(array));
          res.json(array);
        }
      });
    }
  });
});

//POST request handler for returning recieved connections complete profile
app.post("/device/connection/return", function (req, res) {
  console.log("inside return connection route");
  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var userConnections = req.body;

  //Request body is decrypted
  var bytes = CryptoJS.Rabbit.decrypt(userConnections, 'my key is 123');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JSON Object
  var requestConnectionObj = JSON.parse(plaintext);

  User.findOne({ "userId": requestConnectionObj.uid }, { "receivedProfiles": 1, "_id": 0 }).then(function (result) {
    console.log(result);

    var myObj = JSON.stringify(result);
    var parsedObj = JSON.parse(myObj);

    var array = [];

    for (var i = 0; i < parsedObj.length; i++) {

      if (parsedObj[i].connectionId == requestConnectionObj.connectionId) {

        console.log("JS value " + i + ": " + parsedObj[i].connectionId);

        for (var j = 0; j < parsedObj[i].receivedProfileId.length; j++) {

          User.findOne({ "profiles._profileId": parsedObj[i].receivedProfileId[j] }, { "profiles": 1, "_id": 0 }).then(function (err, profile) {
            if (err) {
              console.log(err);
            }
            else {
              var jsonProfileDocumentRetrieved = JSON.stringify(profile);
              var jsObjProfile = JSON.parse(jsonProfileDocumentRetrieved);
              array.push(jsObjProfile);
            }
          }).then(function () {
            if (Object.keys(array).length == parsedObj.receivedProfileId.length) {
              console.log("Final Connected User Profile Array: " + JSON.stringify(array));
            }
          });
        }
      }
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




User.findOne({ "userId": "aaaaaaaaaa" }, { "receivedProfiles": 1, "_id": 0 }).then(function (result) {
  console.log(result);

  var myObj = JSON.stringify(result);
  var parsedObj = JSON.parse(myObj);

  var array = [];

  console.log(parsedObj.receivedProfiles.length);

  for (var i = 0; i < parsedObj.receivedProfiles.length; i++) {

    console.log("inside received profiles sub document" + parsedObj.receivedProfiles.length);

    if (parsedObj.receivedProfiles[i].connectionId == "konnect123") {

      console.log("JS value " + i + ": " + parsedObj.receivedProfiles[i].connectionId);

      for (var j = 0; j < parsedObj.receivedProfiles[i].receivedProfileId.length; j++) {

        User.findOne({ "profiles._profileId": parsedObj.receivedProfiles[i].receivedProfileId[j] }, { "profiles": 1, "_id": 0 }).then(function (profile) {
        console.log(profile);
        console.log(array);
         array.push({
            _profileId: profile._profileId,
            profileName: profile.profileName,
            mobileNo: profile.mobileNo,
            dateOfBirth: profile.dateOfBirth,
            homeAddress: profile.homeAddress,
            email: profile.email,
            links: {
              facebookURL: profile.links.facebookURL,
              twitterURL: profile.links.twitterURL,
              linkedinURL: profile.links.linkedinURL,
              blogURL: profile.links.blogURL
            },
            work: {
              companyName: profile.work.companyName,
              companyWebsite: profile.work.companyWebsite,
              workAddress: profile.work.workAddress,
              workEmail: profile.work.workEmail,
              designation: profile.work.designation
            }
          });         

        }).then(function () {
          console.log("Before if: " + parsedObj.receivedProfiles.receivedProfileId.length);
          if (Object.keys(array).length == parsedObj.receivedProfiles.receivedProfileId.length) {
            console.log("Final Connected User Profile Array: " + JSON.stringify(array));
          }
        });
      }
    }
  }
});