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
mongoose.Promise = global.Promise;

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

let URI = "mongodb://heroku_24qgfjxh:5u7so4mv67fq7ahpjvcpacddgg@ds119489.mlab.com:19489/heroku_24qgfjxh"; //mLab Connection URI
mongoose.connect(URI); //Connecting to mLab Database

/*******************************************************************************************************************************/

/*
******************************************************* 
* DEFINE SCHEMAS AND CREATE MODELS FOR COLLECTIONS
*******************************************************
*/

var Schema = mongoose.Schema;

//Mongo Database schema for user profiles
var profilesSchema = new Schema({
  _id: false,
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

//Mongo Database schema for connected users (users we have shared our profiles with)
var connectedUsersSchema = new Schema({
  _id: false,
  connectedUserId: String,
  sharedProfiles: { type: Array, "default": [] }
});

//Mongo Database schema for received profiles from users who have connected with us
var receivedProfilesSchema = new Schema({
  _id: false,
  connectionId: String, //Requesters ID
  receivedProfileId: { type: Array, "default": [] }
});

//Mongo Database schema for requests for connection
var requestsSchema = new Schema({
  _id: false,
  requesterId: String
});

//Mongo Database schema for the user profile
var usersSchema = new Schema({
  _id: false,
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

//Declaring models for database based on schemas made above
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

  if (!req.body) return res.sendStatus(400);

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

  //Querying for the relevant user's document and pushing the profie to the profiles feild 
  User.findOne({ userId: profObj.uid }).then(function (record) {
    record.profiles.push(profile);
    record.save();
    console.log("New Profile saved successfully");
    res.json("New Profile saved successfully");
  });
});

//POST request handler for editing profiles
app.post("/profile/edit", function (req, res) {

  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var editProfileInfo = req.body;

  //Request body is decrypted
  var bytes = CryptoJS.Rabbit.decrypt(editProfileInfo, 'my key is 123');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JSON Object
  var editProfObj = JSON.parse(plaintext);

  console.log("Updated Profile: " + editProfObj);

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

  if (!req.body) return res.sendStatus(400);

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
    { $pull: { profiles: { _profileId: delProfObj.profId } } },
    { safe: true },
    function (err, obj) {
  
      if (err) {
        console.log(err);
        return
      }
  
      var usersWithProfle = [];
  
      User.findOne({ "userId": delProfObj.uid }, function (err,result1) {
  
        if (err) {
          console.log(err);
          return;
        }
  
       var elements = result1.connectedUsers
        for(var i=0; i< result1.connectedUsers.length; i++){
  
          for(var j=0; j< result1.connectedUsers[i].sharedProfiles.length; j++){
  
            if(result1.connectedUsers[i].sharedProfiles[j] == delProfObj.profId){
              console.log("profile getting pulled IN GIVEN PROF "+result1.connectedUsers[i].sharedProfiles[j]);
              usersWithProfle.push(result1.connectedUsers[i].connectedUserId);
              result1.connectedUsers[i].sharedProfiles.pull(result1.connectedUsers[i].sharedProfiles[j]);
              result1.save();
              
              break;
            }
          }
        }
  
        for(let user of usersWithProfle){
          User.findOne({ "userId": user }, function (err,result) {
  
            if (err) {
              console.log(err);
              return;
            }
  
            for(var i=0; i< result.receivedProfiles.length; i++){
  
              if(result.receivedProfiles[i].connectionId == delProfObj.uid){
  
                for(var j=0; j< result.receivedProfiles[i].receivedProfileId.length; j++){
  
                  if(result.receivedProfiles[i].receivedProfileId[j] == delProfObj.profId){
                    console.log("profile getting pulled in RECIVED PROF "+result.receivedProfiles[i].receivedProfileId[j]);
                    result.receivedProfiles[i].receivedProfileId.pull(result.receivedProfiles[i].receivedProfileId[j]);
                    result.save();
                    
                    break;
                  }
                }  
              }
            }
  
            return;
          });
        }
        return;
        console.log("success");
        res.json("Success");
      });
      
      return;
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

  //Creating json object from mongoose document that contains information of profiles of a particular user
  User.findOne({ userId: uid })
    .populate('_profileId profileName')
    .lean().exec(
    function (err, record) {
      if (err) {
        res.json("Error in retrieving");
        console.log("Error in sending profiles");
      }
      else {       
        //JS object is turned into a JSON Object
        var profiles = JSON.stringify(record.profiles);
        console.log(profiles);
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

  //Creating json object from mongoose document that contains information of profiles of a particular user
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
  console.log("inside return request route");
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

    //Iterate through each of the requesterIds
    for (var i = 0; i < parsedObj.requests.length; i++) {

      console.log("JS value " + i + ": " + parsedObj.requests[i].requesterId);

      //Query each requesterId for their public profile and push it into an array which is then returned to the front end
      User.findOne({ userId: parsedObj.requests[i].requesterId }).then(function (record) {
        console.log("profile retrieved successfully");
        array.push({ 
          userId: record.userId, 
          fName: record.fName, 
          lName: record.lName, 
          bio: record.bio 
        });
        console.log("resultttttttttttt" + JSON.stringify(array));
      }).then(function () {
        //If the number of public profile objects are equal to the number of requesterIds, the array is sent to the front end
        if (Object.keys(array).length == parsedObj.requests.length) {
          console.log("Requesters Public Profiles: " + JSON.stringify(array));
          res.json(array);
        }
      });
    }
  });
});

//POST request handler for allowed connection requests
app.post("/device/requests/allowed", function (req, res) {
  console.log("inside allowed connection requests route");
  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var allowedRequest = req.body;

  //Request body is decrypted
  var bytes = CryptoJS.Rabbit.decrypt(allowedRequest, 'my key is 123');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JSON Object
  var allowedRequestObj = JSON.parse(plaintext);

  //New connected user object is created to add the confirmed requester as a connection in the user's document
  var newConnectedUser = new ConnectedUsers({
    connectedUserId: allowedRequestObj.requesterId,
    sharedProfiles: allowedRequestObj.profileIds
  });

  //New received profile object is created to store the profiles the user has sent them
  var newReceivedProfile = new ReceivedProfile({
    connectionId: allowedRequestObj.uid,
    receivedProfileId: allowedRequestObj.profileIds
  });
  
  //Querying for the relevant user's document and pushing the new connection to the connectedUser subdocument 
  User.findOne({ userId: allowedRequestObj.uid }).then(function (record) {
    record.connectedUsers.push(newConnectedUser);
    record.save();
    console.log("New Connection saved successfully");
    res.json("New Connection saved successfully");
  });

  //Querying for the requesters document and pushing the new connection to the receivedProfiles subdocument 
  User.findOne({ userId: allowedRequestObj.requesterId }).then(function(record) {
    record.receivedProfiles.push(newReceivedProfile);
    record.save();
    console.log("New Received Profile saved successfully");    
  });

  //Removing newly added connection from requests sub document
  User.update(
    { userId: allowedRequestObj.uid },
    { $pull: { requests: { requesterId: allowedRequestObj.requesterId } } },
    { safe: true },
    function removeRequester(err, obj) {
      if (err) {
        console.log(err);
      }
      else {
        console.log("Succesfully deleted request: " + obj);
      }  
  });
});

//POST request handler for declined connection requests
app.post("/device/requests/declined", function (req, res) {
  console.log("inside declined connection requests route");
  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var declinedRequest = req.body;

  //Request body is decrypted
  var bytes = CryptoJS.Rabbit.decrypt(declinedRequest, 'my key is 123');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JSON Object
  var declinedRequestObj = JSON.parse(plaintext);  

  console.log("DILLONS DECLINE UID: " + declinedRequestObj.uid);
  console.log("DILLONS DECLINE REQUESTER ID: " + declinedRequestObj.requesterId);

  //Query for user's document and delete declined requesterId from requests array
  User.update(
    { userId: declinedRequestObj.uid },
    { $pull: { requests: { requesterId: declinedRequestObj.requesterId } } },
    { safe: true },
    function removeRequester(err, obj) {
      if (err) {
        console.log(err);
      }
      else {
        console.log("Succesfully deleted request: " + obj);
        res.json("Succesfully deleted request");
      }  
    });  
});

//POST request handler for returning recieved connections basic profile
app.post("/device/connections/received/publicprofiles", function (req, res) {
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

  User.findOne({ "userId": requestConnectionObj.uid}, { "receivedProfiles": 1, "_id": 0 }, function (err,result) {
    if(err){
      console.log("Error "+err);
      return
    }
  
    var array = [];    
    var Users = result.receivedProfiles;  
    console.log(result);
  
    //Iterate through the receivedProfiles subdocument of the user
    for (let profile of Users) {  
      //Query for the receivedProfile of the specified connectionId and push their public profile to an array
      User.findOne({ userId: profile.connectionId }, function (err,record) {  
        if(err){
          console.log("Error "+err);
          return
        }
  
        console.log("RESULT" + record);
        array.push({ userId: record.userId, fName: record.fName, lName: record.lName, bio: record.bio });     
  
        //If the number of public profile objects is equal to the number of receivedProfiles, the array is returned to the front end
        if (Object.keys(array).length == Users.length) {
          console.log("ARRAY " + JSON.stringify(array));
          res.json(JSON.stringify(array));
        }  
        return;  
      });  
    }
    return;   
  });
});

//POST request handler for returning received connections complete profile
app.post("/device/connections/received/profile", function (req, res) {
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

  //Query user's document and retrieve receivedProfiles from sub document
  User.findOne({"userId": requestConnectionObj.uid}, {receivedProfiles: {$elemMatch: {connectionId: requestConnectionObj.connectionId}}}, function(err, result){
    if(err){
      console.log("Error "+err);
      return
    }
    var array = [];
    
    var profiles = result.receivedProfiles[0].receivedProfileId;
  
    for (let profile of profiles) {
  
      User.findOne({"userId": requestConnectionObj.connectionId}, {profiles: {$elemMatch: {_profileId: profile}}},function(err, result){
        if(err) {
          console.log("Error "+err);
          return
        }
        array.push({
          _profileId: result.profiles[0]._profileId,
          profileName: result.profiles[0].profileName,
          mobileNo: result.profiles[0].mobileNo,
          dateOfBirth: result.profiles[0].dateOfBirth,
          homeAddress: result.profiles[0].homeAddress,
          email: result.profiles[0].email,
          links: {
            facebookURL: result.profiles[0].links.facebookURL,
            twitterURL: result.profiles[0].links.twitterURL,
            linkedinURL: result.profiles[0].links.linkedinURL,
            blogURL: result.profiles[0].links.blogURL
          },
          work: {
            companyName: result.profiles[0].work.companyName,
            companyWebsite: result.profiles[0].work.companyWebsite,
            workAddress: result.profiles[0].work.workAddress,
            workEmail: result.profiles[0].work.workEmail,
            designation: result.profiles[0].work.designation
          }
        });
  
        if (Object.keys(array).length == profiles.length) {
          console.log("ARRAY "+JSON.stringify(array));
          res.json(JSON.stringify(array));
        }
        
        return
      });
    }
    return
  });

});

//POST request handler for returning basic profiles of individuals with whome the user has shared profiles with
app.post("/device/connections/sent/publicprofile", function (req, res) {
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

  User.findOne({ "userId": requestConnectionObj.uid }, { "connectedUsers": 1, "_id": 0 }, function (err,result) {

    if(err){
      console.log("Error "+err);
      return
    }
  
    var array = [];    
    var Users = result.connectedUsers;  
    console.log(result);
  
    for (let profile of Users) {  
      User.findOne({ userId: profile.connectedUserId }, function (err,record) {  
        if(err){
          console.log("Error "+err);
          return
        }
  
        console.log("RESULT" + record);
        array.push({ userId: record.userId, fName: record.fName, lName: record.lName, bio: record.bio });     
  
        if (Object.keys(array).length == Users.length) {
          console.log("ARRAY " + JSON.stringify(array));
          res.json(JSON.stringify(array));
        }  
        return;  
    });  
    }
    return; 
  
  });
});

//POST request handler for returning shared profile names to grant/revoke
app.post("/device/connections/sent/grantrevoke/select", function (req, res) {
  console.log("inside return connection route");
  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var grantRevokeSelect = req.body;

  //Request body is decrypted
  var bytes = CryptoJS.Rabbit.decrypt(grantRevokeSelect, 'my key is 123');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  // Request body is parsed to a JSON Object
  var grantRevokeSelectObj = JSON.parse(plaintext);

  User.findOne({"userId": grantRevokeSelectObj.uid}, {connectedUsers: {$elemMatch: {connectedUserId: grantRevokeSelectObj.connectedUserId}}}, function(err, result){
    if(err){
      console.log("Error "+err);
      return
    }
  
    var array = [];
    
    var sharedProfiles = result.connectedUsers[0].sharedProfiles;
  
    console.log("shared profiles "+sharedProfiles);
  
    User.findOne({"userId": grantRevokeSelectObj.uid}, {"profiles":1 },function(err, resultProfiles){
      if(err) {
        console.log("Error "+err);
        return
      }
  
      var AllProfiles = resultProfiles.profiles;
  
      //console.log("All profiles "+ AllProfiles);
  
      for(let prof of AllProfiles){
        array.push({
          profileName: prof.profileName, 
          grantedStatus: false, 
          _profileId: prof._profileId     
       });
      }
  
     console.log(JSON.stringify(array));
  
     for(let sharedProf of sharedProfiles){
       for(var i=0; i < array.length; i++){
          if(array[i]._profileId == sharedProf ){
            array[i] = {
               profileName: array[i].profileName, 
               grantedStatus: true, 
               _profileId: array[i]._profileId     
            };
            console.log("inside if "+JSON.stringify(array));                    
          }        
       }
      }
  
      console.log("ARRAY "+JSON.stringify(array));
      res.json(JSON.stringify(array));
      return  
    });
    return  
  }); 
});

//POST request handler for handling granting/revoking of shared profiles to connected users
app.post("/device/connections/sent/grantrevoke/handle", function (req, res) {
  console.log("inside handling granting revoking route");

  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var grantRevoke = req.body;

  //Request body is decrypted
  var bytes = CryptoJS.Rabbit.decrypt(grantRevoke, 'my key is 123');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JSON Object
  var grantRevokeObj = JSON.parse(plaintext);
 
    // var modifiedProfiles = [
    //   {
    //     profileName: "Sample", 
    //     grantedStatus: false, 
    //     _profileId: "5abb694e26b24d000480c93a"
    //   }, 
    //   {
    //     profileName: "Sampe 2", 
    //     grantedStatus: true, 
    //     _profileId: "5abb7e9396f60300044034e4"
    //   },
    //   {
    //     profileName: "red", 
    //     grantedStatus: true, 
    //     _profileId: "5abb7e9a96f60300044034e7"
    //   },
    //   {
    //     profileName: "Red", 
    //     grantedStatus: false, 
    //     _profileId: "5abba10e440f840004dc52fb"
    //   }
    // ];
 
    var modifiedProfiles = grantRevokeObj.modifiedProfiles;
    console.log(modifiedProfiles);

    var allowedProfilesArray = [];

    for (var i = 0; i < modifiedProfiles.length; i++) {
      if (modifiedProfiles[i].grantedStatus == "true") {
        allowedProfilesArray.push(modifiedProfiles[i]._profileId);
      }
    }

    console.log("Allowed Profiles Array: " + allowedProfilesArray);

    //New ConnectedUsers object to push to connectedUsers subdocument of user
    var newConnectedUserObj = new ConnectedUsers({
      sharedProfiles: allowedProfilesArray,
      connectedUserId: grantRevokeObj.connectedUserId
    });

    console.log("New Connected User: " + newConnectedUserObj);

    //New ReceivedProfile object to push to receivedProfiles subdocument of connection
    var newReceivedProfileObj = new ReceivedProfile({
      connectionId: grantRevokeObj.uid,
      receivedProfileId: allowedProfilesArray
    });

    console.log("New Received Profile: " + newReceivedProfileObj);

  //Delete current data from user's connectedUsers subdocument
  User.update(
    { userId: grantRevokeObj.uid },
    { $pull: { connectedUsers: { connectedUserId: grantRevokeObj.connectedUserId } } },
    { safe: true },
    function removeConnectedUser(err, obj) {
      if (err) {
        console.log(err);
      }
      else {
        console.log("Succesfully deleted connected user: " + obj);
      }  
  });

  //Delete current data from connection's receivedProfiles subdocument
  User.update(
    { userId: grantRevokeObj.connectedUserId },
    { $pull: { receivedProfiles: { connectionId: grantRevokeObj.uid } } },
    { safe: true },
    function removeReceivedProfile(err, obj) {
      if (err) {
        console.log(err);
      }
      else {
        console.log("Succesfully deleted received profile: " + obj);
      }  
  });
    
  //Querying for the relevant user's document and pushing the updated connection to the connectedUser subdocument 
  User.findOne({ userId: grantRevokeObj.uid }).then(function(userRecord) {
    userRecord.connectedUsers.push(newConnectedUserObj);
    userRecord.save();
    console.log("Updated Connection saved successfully");
  });

  //Querying for the relevant connetion's document and pushing the updated allowed profiles to the receivedProfiles subdocument 
  User.findOne({ userId: grantRevokeObj.connectedUserId }).then(function(connectionRecord) {
    connectionRecord.receivedProfiles.push(newReceivedProfileObj);
    connectionRecord.save();
    console.log("Updated Received Profile saved successfully");
    //res.json("New Connection saved successfully");
  });
});

//-------------------------------------REMAKE THE CODE TO RETRIEVE  DECODED JSON AND ASSIGN TO QUERY---------------------------------
//------------------------------------------------------------------------------------------------------------------------------------

//POST request handler for storing requests
app.post("/device/requests/store", function (req, res) {

  console.log("inside storeRequest route");
  if (!req.body) return res.sendStatus(400);

  User.findOne({ "userId": "aaaaaaaaaa" }, { "connectedUsers": 1, "_id": 0 }, function (err,result1) {

    if(err){
      console.log("Error "+err);
      return
    }
  
    received = { sharedProfiles: ["konnect123", "123456kon","duckyou123"], uid: "aaaaaaaaaa" }
    receivedRequests = received.sharedProfiles
    connectedUsers = result1.connectedUsers
  
    for(let connecterUser of connectedUsers){
      for(let i=0; i < receivedRequests.length; i++){
        if(connecterUser.connectedUserId == receivedRequests[i] ){
          receivedRequests.splice(i, 1);
          break;
        }
      }
    }
  
    User.findOne({ "userId": "aaaaaaaaaa" }, function (err,result) {
  
      if(err){
        console.log("Error "+err);
        return
      }
  
      currentReqests = result.requests
      console.log("result of query "+result);
      console.log("RESULT of REQUEST ARRAY"+currentReqests);
  
      for(let request of currentReqests){
        for(let i=0; i < receivedRequests.length; i++){
          if(request.requesterId == receivedRequests[i] ){
            console.log("inside if"+receivedRequests[i]);
            receivedRequests.splice(i, 1);
          }
          
        }
      }
  
      for(let newRequest of receivedRequests){
        
        var element={requesterId: newRequest};
        result.requests.push(element);
        result.save();
        console.log("saved "+ element);
      }
  
      console.log(receivedRequests);
      res.send("success");
  
    });    
  
  });
});

/******************************************************************************************************************************/



//Testing handling granting revoking

// User.findOne({"userId": "aaaaaaaaaa"}, {connectedUsers: {$elemMatch: {connectedUserId: "konnect123"}}}, function(err, result){
//     console.log(result);

//     if(err){
//       console.log("Error "+err);
//       return
//     }

//     var currSharedProfiles = result.connectedUsers[0].sharedProfiles;
//     var modifiedProfiles = [
//       {
//         profileName: "Sample", 
//         grantedStatus: false, 
//         _profileId: "5abb694e26b24d000480c93a"
//       }, 
//       {
//         profileName: "Sampe 2", 
//         grantedStatus: true, 
//         _profileId: "5abb7e9396f60300044034e4"
//       },
//       {
//         profileName: "red", 
//         grantedStatus: true, 
//         _profileId: "5abb7e9a96f60300044034e7"
//       },
//       {
//         profileName: "Red", 
//         grantedStatus: false, 
//         _profileId: "5abba10e440f840004dc52fb"
//       }
//     ];

//     var allowedProfilesArray = [];

//     for (var i = 0; i < modifiedProfiles.length; i++) {
//       if (modifiedProfiles[i].grantedStatus == true) {
//         allowedProfilesArray.push(modifiedProfiles[i]._profileId);
//       }
//     }

//     //New ConnectedUsers object to push to connectedUsers subdocument of user
//     var newConnectedUserObj = new ConnectedUsers({
//       sharedProfiles: allowedProfilesArray,
//       connectedUserId: "konnect123"
//     });

//     //New ReceivedProfile object to push to receivedProfiles subdocument of connection
//     var newReceivedProfileObj = new ReceivedProfile({
//       connectionId: "aaaaaaaaaa",
//       receivedProfileId: allowedProfilesArray
//     });

//   //Delete current data from user's connectedUsers subdocument
//   User.update(
//     { userId: "aaaaaaaaaa" },
//     { $pull: { connectedUsers: { connectedUserId: "konnect123" } } },
//     { safe: true },
//     function removeConnectedUser(err, obj) {
//       if (err) {
//         console.log(err);
//       }
//       else {
//         console.log("Succesfully deleted connected user: " + obj);
//       }  
//   });

//   //Delete current data from connection's receivedProfiles subdocument
//   User.update(
//     { userId: "konnect123" },
//     { $pull: { receivedProfiles: { connectionId: "aaaaaaaaaa" } } },
//     { safe: true },
//     function removeReceivedProfile(err, obj) {
//       if (err) {
//         console.log(err);
//       }
//       else {
//         console.log("Succesfully deleted received profile: " + obj);
//       }  
//   });
    
//   //Querying for the relevant user's document and pushing the updated connection to the connectedUser subdocument 
//   User.findOne({ userId: "aaaaaaaaaa" }).then(function(userRecord) {
//     userRecord.connectedUsers.push(newConnectedUserObj);
//     userRecord.save();
//     console.log("Updated Connection saved successfully");
//   });

//   //Querying for the relevant connetion's document and pushing the updated allowed profiles to the receivedProfiles subdocument 
//   User.findOne({ userId: "konnect123" }).then(function(connectionRecord) {
//     connectionRecord.receivedProfiles.push(newReceivedProfileObj);
//     connectionRecord.save();
//     console.log("Updated Received Profile saved successfully");
//     //res.json("New Connection saved successfully");
//   });

    
//   });
