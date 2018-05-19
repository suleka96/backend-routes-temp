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


/*
******************************************************* 
* INITIALIZE EXPRESS AND FIREBASE ADMIN SDK
*******************************************************
*/

const app = express();//initialize express

//initialize firebase admin sdk
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://konnect-ionic-auth.firebaseio.com"
});


/*
******************************************************* 
* DEFINE PATHS
*******************************************************
*/
app.use(express.static(path.join(__dirname, "public"))); //Define path for static assets
app.set("views", path.join(__dirname, "views")); //Define path for views
app.set("view engine", "ejs"); //Define view engine as EJS
app.use(cors());
mongoose.Promise = global.Promise; //Declare mongoose promises globally


/*
******************************************************* 
* SET PORT
*******************************************************
*/

/*
* SECURITY RISKS
*===========================================================================
* Port Scanning - A mechanism used by unauthorized third parties to discover access points to a web application which in turn can
* be used to hack into it.
*
* HOW THE SECURITY RISKS WERE ADDRESSED
*===========================================================================
* Port is set at runtime through the means of an environment variable assigned by the Cloud Service Provider(Heroku) and is not
* displayed to the developer at development time.
* The CSP is free to randomize the port number if so desired without a conflict arising with the developer or end user.
*/

const PORT = process.env.PORT || 5000; //Port is assigned at runtime by Heroku or 5000 by default
app.listen(PORT, () => console.log(`Listening on ${PORT}`));


/*
******************************************************* 
* CONNECTION TO DATABASE
*******************************************************
*/

/*
* SECURITY RISKS
*===========================================================================
* If an unauthorized third party gets hold of the Database Connection URI, the authenticity and validity of the data would be compromised.
* This could lead to disastrous circumstances since we are handling sensitive information.
*
* HOW THE SECURITY RISKS WERE ADDRESSED
*===========================================================================
* mLab Connection URI is set previously to an environment variable by Heroku.
* This is for additional security when pushing to publuc repositories or general security of the hosted application.
* Therefore, the URI is not visible for manipulation by developer nor third party
*/

let URI = process.env.MONGODB_URI; //mLab Connection URI
mongoose.connect(URI); //Connecting to mLab Database


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
  connectedUserId: String,
  sharedProfiles: { type: Array, "default": [] }
});

//Mongo Database schema for received profiles from users who have connected with another perticular user
var receivedProfilesSchema = new Schema({    
  connectionId: String, //Requesters ID
  receivedProfileId: { type: Array, "default": [] }
});

//Mongo Database schema for connection request
var requestsSchema = new Schema({  
  requesterId: { type: Array, "default": [] }
});

//Mongo Database schema for the user profile
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


/*
****************************************************************
* DECLARING MODELS BASED ON THE SCHEMAS MADE
****************************************************************
*/

//model for the profile subdocument
var Profile = mongoose.model("profiles", profilesSchema);
//model for the received profile subdocument
var ReceivedProfile = mongoose.model("receivedProfiles", receivedProfilesSchema);
//model  for the user collection
var User = mongoose.model("users", usersSchema);
//model for connected users subdocument
var ConnectedUsers = mongoose.model("connectedUsers", connectedUsersSchema);
//model for the request subdocument
var Request = mongoose.model("requests", requestsSchema);


/*
******************************************************* 
* GLOBALLY DECLARE BODY PARSER 
*******************************************************
*/
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

/*
*************************************************************************************************************
*                                           ROUTES
*************************************************************************************************************
*/


/*
* SECURITY RISKS
*===========================================================================
* Each of the below mentioned routes handle POST and GET requests from the client.
* Data in memory could be monitored, extracted or tampered by unauthorized third parties through variouse attacks.
* Data could also be manipulated and corrupted while in transit.
*
* HOW THE SECURITY RISKS WERE ADDRESSED
*===========================================================================
* Encryption has been used to secure the request and response bodies(objects) both.
* The encryption library used is CryptoJS with the cipher algorithm Rabbit.
*For the decryption and encryption process a secret key is required which is only known by the client and the server, this further
  ensures the security of the data, as even if a third party access the data while it is being transmitted, those parties
  will not be able to decrypt the information without the key. 
* Garbage Collection has also been requested at the end of each route to aid in decommissioning of data in memory.

 EXISTING SECURITY RISKS
*===========================================================================
* Measures to prevent corruption of data were not taken and denial of service was not addressed
*/


/*
******************************************************* 
*GET request handler for index route
*******************************************************
*/
app.get("/", (req, res) => res.render("pages/index"));


/*
******************************************************* 
*POST request handler for register route
*******************************************************
*/

app.post("/register", function (req, res) {
  console.log("Registration process has started...");
  if (!req.body) return res.sendStatus(400);

  //Received encrypted request body
  var registerInfo = req.body;

  //Request body is decrypted with agreed upon key
  var bytes = CryptoJS.Rabbit.decrypt(registerInfo, 'hfdsahgdajshgjdsahgjfafsajhkgs');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JS Object
  var regObj = JSON.parse(plaintext);

  console.log("Registration Details Decrypted Object: " + regObj);

  //Create a new user with the credentials provided by the client using the createUser() function provided by the Firebase Admin SDK
  admin.auth().createUser({
    uid: regObj.uuid,
    email: regObj.email,
    password: regObj.password,
    displayName: regObj.fName + " " + regObj.lName
  })
    .then(function (userRecord) {      
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
        connectedUsers: [],
        receivedProfiles: []
      });

      //Save created user document
      user.save(function (err) {
        if (err) console.log('Database Error: ' + err);
      });      
      /*Here the response is not encrypted as it is just a string value which the client will not be using for any further operations.
      * It is merely an acknowledgement
      */
      res.json("User has been registered and document created successfully"); // Send client a response with success message

      //Decommissioning of Data using Garbage Collection
      if (global.gc) {
        global.gc();
      } 
      else {
        console.log("Error in Garbage Collection: " + ex);
      }
    })
    .catch(function (error) {
      console.log("Error creating new user:", error);
    });    
});

/*
******************************************************* 
* POST request handler for creating a profile
*******************************************************
*/


app.post("/profiles/create", function (req, res) {

  console.log("inside createProfile route");

  //send error status if request body is empty
  if (!req.body) return res.sendStatus(400);

  //received encrypted request body is assigned to a variable 
  var profileInfo = req.body;

  //request body inside the variable profileInfo is decrypted using the crypto.js library's rabbit encryption algorithem 
  var byteString = CryptoJS.Rabbit.decrypt(profileInfo, 'hfdsahgdajshgjdsahgjfafsajhkgs');

  //decrypted request body inside the variable byteString is converted to a string
  var information = byteString.toString(CryptoJS.enc.Utf8);

  //the request body string inside the information variable is parsed to a JSON Object
  var profObj = JSON.parse(information);

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

  //querying for the relevant user's document and pushing the profile to the profiles sub document  
  User.findOne({ userId: profObj.uid },function (error,record) {
      if (error) {
          console.log(error);
          return;
        }
       
      record.profiles.push(profile);
      record.save();
      console.log("New Profile saved successfully");
      res.json("New Profile saved successfully");// sending success message string back to the client
      //invoking garbade collection to free memory 
      if (global.gc) {
          global.gc();
      } else {
          console.log("ERROR"+"garbade collection unavailable.");
      }
  });
});


/*
******************************************************* 
* POST request handler for editing profiles
*******************************************************
*/

app.post("/profile/edit", function (req, res) {

  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var editProfileInfo = req.body;

  //Request body is decrypted with agreed upon key
  var bytes = CryptoJS.Rabbit.decrypt(editProfileInfo, 'hfdsahgdajshgjdsahgjfafsajhkgs');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JS Object
  var editProfObj = JSON.parse(plaintext);

  console.log("Updated Profile: " + editProfObj);    

  // User document is queried for the specific profile and the updated profile is pushed to replace the current selection
  User.update({ "profiles._profileId": editProfObj._profileId }, { "profiles.$": editProfObj }, function (err, raw) {
    if (err) {
      console.log(err);
    }
    else {
      console.log(raw);
      /*Here the response is not encrypted as it is just a string value which the client will not be using for any further operations.
      * It is merely an acknowledgement
      */
      res.json("Profile edited successfully!");

      //Decommissioning of Data using Garbage Collection
      if (global.gc) {
          global.gc();
      } 
      else {
          console.log("Error in Garbage Collection: " );
      }
    }
  });    
});

/*
******************************************************* 
* POST request handler for deleting a profile
*******************************************************
*/

app.post("/profile/delete", function (req, res) {

  console.log("Inside delete profile route");

  //send error status if request body is empty
  if (!req.body) return res.sendStatus(400);

  //received encrypted request body is assigned to a variable 
  var delProfileInfo = req.body;

  //request body inside the variable profileInfo is decrypted using the crypto.js library's rabbit encryption algorithem 
  var byteString = CryptoJS.Rabbit.decrypt(delProfileInfo, 'hfdsahgdajshgjdsahgjfafsajhkgs');

  //decrypted request body inside the variable byteString is converted to a string
  var information = byteString.toString(CryptoJS.enc.Utf8);

  //the request body string inside the information variable is parsed to a JSON Object
  var delProfObj = JSON.parse(information);
  
  //querying for the relevant user's profiles sub document and deleting the relevant profile from it
  User.update(
    { userId: delProfObj.uid },
    { $pull: { profiles: { _profileId: delProfObj._profileId } } },
    { safe: true },
    function (err, obj) {  
      if (err) {
        console.log(err);
        return
      }
  
      var usersWithProfle = [];//array to store the uids of users who were given the perticular profile
  
      //querying for the user's document
      User.findOne({ "userId": delProfObj.uid }, function (err,result1) {
  
        if (err) {
          console.log(err);
          return;
        }
       
       //iterating through the elements in the connectedUsers sundocument 
       var elements = result1.connectedUsers
        for(var i=0; i< result1.connectedUsers.length; i++){
          //iterating through the elements of the sharedProfiles array in each of the elemets inside the connected users sub document
          for(var j=0; j< result1.connectedUsers[i].sharedProfiles.length; j++){
              
            if(result1.connectedUsers[i].sharedProfiles[j] == delProfObj.profId){
                /*if the id of the profile to be deleted is equal to an id found in the array it
                will be removed from the array and the connectedUserId of that element will be added
                to the usersWithProfle array
                */
              usersWithProfle.push(result1.connectedUsers[i].connectedUserId);
              result1.connectedUsers[i].sharedProfiles.pull(result1.connectedUsers[i].sharedProfiles[j]);
              result1.save();
              
              break;
            }
          }
        }
        
        //iterating through the usersWithProfle array
        for(let user of usersWithProfle){
            //quering for uer document with a uid inside the array
          User.findOne({ "userId": user }, function (err,result) {
  
            if (err) {
              console.log(err);
              return;
            }
            
            //iterating through the elements in the receivedProfiles sundocument 
            for(var i=0; i< result.receivedProfiles.length; i++){
              
              if(result.receivedProfiles[i].connectionId == delProfObj.uid){
                  //iterating through the elements of the receivedProfileId array in the chosen sub document
                for(var j=0; j< result.receivedProfiles[i].receivedProfileId.length; j++){

                  if(result.receivedProfiles[i].receivedProfileId[j] == delProfObj.profId){
                       /*if the id of the profile to be deleted is equal to an id found in the array it
                   will be removed from the array */  
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
        res.json("Success");//sending a success response to the client if profile was successfully deleted
        //invoking garbade collection to free memory 
        if (global.gc) {
          global.gc();
        } else {
          console.log("ERROR"+"garbade collection unavailable.");
        }
      });
      return;
  });
 
});

  /*
***************************************************************************
* POST request handler for sending profiles
***************************************************************************
*/

app.post("/profiles/send", function (req, res) {
  console.log("inside sending profile ID route");
  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var uidEncrypted = req.body;

  //Request body is decrypted with agreen upon key
  var bytes = CryptoJS.Rabbit.decrypt(uidEncrypted, 'hfdsahgdajshgjdsahgjfafsajhkgs');

  //Decrypted request body is converted to plain text
  var uid = bytes.toString(CryptoJS.enc.Utf8);

  //Creating JSON object from mongoose document that contains information of profiles of a particular user
  User.findOne({ userId: uid })
    .populate('_profileId profileName')
    .lean().exec( //Lean converts the mLab native BSON document into a JS Object
    function (err, record) {
      if (err) {
        console.log("Error in sending profiles");
      }
      else {       
        //JS object is converted into a JSON Object
        var profiles = JSON.stringify(record.profiles);
        console.log(profiles);
        /* Here, the response object is encrypted using the same agreed upon key and sent back the client as JSON.*/
        var encrypted = CryptoJS.Rabbit.encrypt(profiles, "hfdsahgdajshgjdsahgjfafsajhkgs");
        res.send(encrypted);

        //Decommissioning of Data using Garbage Collection
        if (global.gc) {
          global.gc();
        } 
        else {
          console.log("Error in Garbage Collection: " );
        }
      }
    });
  
});


  /*
***************************************************************************
* POST request handler for sending information of a profile to the client
***************************************************************************
*/
  
app.post("/profile/send", function (req, res) {
  console.log("inside sending individual profiles route");

  //send error status if request body is empty
  if (!req.body) return res.sendStatus(400);

  //received encrypted request body is assigned to a variable 
  var userProfileInfo = req.body;

  //request body inside the variable profileInfo is decrypted using the crypto.js library's rabbit encryption algorithem 
  var byteString = CryptoJS.Rabbit.decrypt(userProfileInfo, 'hfdsahgdajshgjdsahgjfafsajhkgs');

  //decrypted request body inside the variable byteString is converted to a string
  var information = byteString.toString(CryptoJS.enc.Utf8);

  //the request body string inside the information variable is parsed to a JSON Object
  var infoObj = JSON.parse(information);

  /* HCI Issues:         
  The time gap between the request and the response is noticibly high. Due to this reason the front-end UI components take time 
  to render as they need information from the server to dynamically create those components.

  Solutions: made the profile id globally unique so that it can be queried separately without getting a user document
  and traversing through the elements to find a perticular profile, thus reducing the querying time
  */

  //quering for a perticular profiles of a user
  User.findOne({ "profiles._profileId": infoObj._profileId }, { "profiles.$": 1, "_id": 0 }, function (err, profile) {
    if (err) {
      console.log(err);
    }
    else {
      //making the recived result into a JSON object
      var profile = JSON.stringify(profile);
      //encrypting the object using the secret key
      var encryptedObj = CryptoJS.Rabbit.encrypt(profile, "hfdsahgdajshgjdsahgjfafsajhkgs");
      //sending the object as a response to the client
      res.json(encryptedObj);
      //invoking garbade collection to free memory 
      if (global.gc) {
          global.gc();
      } else {
          console.log("ERROR"+"garbade collection unavailable.");
      }
    }
  });
});


 /*
***************************************************************************
* POST request handler for returning public profile of requests
***************************************************************************
*/

app.post("/device/requests/return", function (req, res) {
  console.log("inside return request route");

  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var userRequest = req.body;

  //Request body is decrypted with agreen upon key
  var bytes = CryptoJS.Rabbit.decrypt(userRequest, 'hfdsahgdajshgjdsahgjfafsajhkgs');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JS Object
  var requestInfoObj = JSON.parse(plaintext);

  var array = [];

    //User document is queried for the requests sub document
    User.findOne({ "userId": requestInfoObj.uid }, { "requests": 1, "_id": 0 },function (err,result) {


      if(err){
        console.log("Error "+err);
        return
      }
  
      console.log("Retrieved Requests Object from DB: " + result);   
  
      //Iterate through each of the requesterIds
      for (var i = 0; i < result.requests.length; i++) {
  
        console.log("Requester ID: " + i + ": " + result.requests[i].requesterId);
  
        //Query each requesterId for their public profile and push it into an array which is then returned to the front end
        User.findOne({ userId: result.requests[i].requesterId },function(err, profile){   
          if(err){
                  console.log("Error "+err);
                  return
                }       
  
          console.log("profile retrieved successfully");
          //Each requester's public profile is pushed to an array
          array.push({ 
            userId: profile.userId, 
            fName: profile.fName, 
            lName: profile.lName, 
            bio: profile.bio 
          });
  
          //If the number of public profile objects are equal to the number of requesterIds, the array is sent to the front end as a response
          if (Object.keys(array).length == result.requests.length) {
            var jsonArray = JSON.stringify(array);
            console.log("Requesters Public Profiles: " + jsonArray);
            /* Here, the response object is encrypted using the same agreed upon key and sent back the client as JSON.*/
            var encrypted = CryptoJS.Rabbit.encrypt(jsonArray, "hfdsahgdajshgjdsahgjfafsajhkgs");
            res.json(encrypted);
          
           //Decommissioning of Data using Garbage Collection
           if (global.gc) {
              global.gc();
           } 
           else {
              console.log("Error in Garbage Collection: ");
           }
          } 
        });
    }  
    });
  });



  /*
***************************************************************************
* POST request handler for allowed connection requests
***************************************************************************
*/

app.post("/device/requests/allowed", function (req, res) {
  console.log("inside allowed connection requests route");
  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var allowedRequest = req.body;

  //Request body is decrypted with agreed upon key
  var bytes = CryptoJS.Rabbit.decrypt(allowedRequest, 'hfdsahgdajshgjdsahgjfafsajhkgs');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JSON Object
  var allowedRequestObj = JSON.parse(plaintext);

  /*
  * HCI ISSUE
  *===========================================================================
  * When handling allowed connection requests, there appeared to be a lag in the client application since the backend has
  * many operations to be done to add a new connected user, namely, deleting the user from the requests sub document, adding that user to the connectedUsers 
  * sub document along with the profiles the user has shared and finally adding the user as a connection in the newly confirmed connections document in the 
  * database.
  * Therefore, we can see that there are modifications to be made across the entire collection.
  * According to the HCI Principle of LATENCY REDUCTION, the client app has to be always quick to respond to the user's needs. Therefore, the issue of this lag has to be addressed.
  *
  * HOW THE HCI ISSUE WAS ADDRESSED
  *===========================================================================
  * Efficiency is significantly increased due to the fact that we created Schema models for each sub document in a user document.
  * In this way the need to create custom objects each time a request is confirmed is abolished.
  * This reduces a great deal of performance lag as the parameters for the sub document is already defined beforehand.
  * This also helps to keep the database clean and readable.
  */

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
    /*Here the response is not encrypted as it is just a string value which the client will not be using for any further operations.
    * It is merely an acknowledgement
    */
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

  //Decommissioning of Data using Garbage Collection
  if (global.gc) {
      global.gc();
  } 
  else {
      console.log("Error in Garbage Collection: " );
  }
});

   /*
***************************************************************************
* POST request handler for declined connection requests
***************************************************************************
*/

app.post("/device/requests/declined", function (req, res) {

  console.log("inside declined connection requests route");

  //send error status if request body is empty
  if (!req.body) return res.sendStatus(400);

  //received encrypted request body is assigned to a variable 
  var declinedRequest = req.body;

  //request body inside the variable profileInfo is decrypted using the crypto.js library's rabbit encryption algorithem 
  var byteString = CryptoJS.Rabbit.decrypt(declinedRequest, 'hfdsahgdajshgjdsahgjfafsajhkgs');

  //decrypted request body inside the variable byteString is converted to a string
  var information = byteString.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JSON Object
  var declinedRequestObj = JSON.parse(information);  

  //Query for requests sub document of the user's document and delete declined requesterId from requests array
  User.update(
    { userId: declinedRequestObj.uid },
    { $pull: { requests: { requesterId: declinedRequestObj.requesterId } } },
    { safe: true },
    function removeRequester(err, obj) {
      if (err) {
        console.log(err);
      }
      else {
        res.json("Succesfully deleted request");//sending a success response to the client if request was successfully deleted
        //invoking garbade collection to free memory 
        if (global.gc) {
          global.gc();
        } else {
          console.log("ERROR"+"garbade collection unavailable.");
        }
      }  
    });  
});



     /*
***************************************************************************
* POST request handler for returning recieved connections public profile
***************************************************************************
*/

app.post("/device/connections/received/publicprofiles", function (req, res) {
  console.log("inside return connections route");
  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var userConnections = req.body;

  //Request body is decrypted with the agreed upon key
  var bytes = CryptoJS.Rabbit.decrypt(userConnections, 'hfdsahgdajshgjdsahgjfafsajhkgs');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  //Request body is parsed to a JSON Object
  var requestConnectionObj = JSON.parse(plaintext);

  //User document is queried for the receivedProfiles sub document
  User.findOne({ "userId": requestConnectionObj.uid}, { "receivedProfiles": 1, "_id": 0 }, function (err,result) {
    if(err){
      console.log("Error "+err);
      return
    }
  
    var array = [];    
    var receivedProfileUsers = result.receivedProfiles;  
    console.log("Received Profiles from Connected Users: " + result);
  
    //Iterate through the receivedProfiles subdocument of the user
    for (let profile of receivedProfileUsers) {  
      //Query for the receivedProfile of the specified connectionId and push their public profile to an array
      User.findOne({ userId: profile.connectionId }, function (err,record) {  
        if(err){
          console.log("Error "+err);
          return
        }
        //Public profile of connected users are pushed to the array at each iteration
        array.push({ userId: record.userId, fName: record.fName, lName: record.lName, bio: record.bio });     
  
        //If the number of public profile objects is equal to the number of receivedProfiles, the array is returned to the front end
        if (Object.keys(array).length == receivedProfileUsers.length) {
          console.log("ARRAY " + JSON.stringify(array));
          var jsonArray = JSON.stringify(array);
          /* Here, the response object is encrypted using the same agreed upon key and sent back the client as JSON.*/
          var encrypted = CryptoJS.Rabbit.encrypt(jsonArray, "hfdsahgdajshgjdsahgjfafsajhkgs");
          res.json(encrypted);

          //Decommissioning of Data using Garbage Collection
          if (global.gc) {
              global.gc();
          } 
          else {
              console.log("Error in Garbage Collection: " );
          }
        }  
        return 
      });  
    }
    return 
  });
  
});



     /*
***************************************************************************
* POST request handler for returning received connections complete profile
***************************************************************************
*/

app.post("/device/connections/received/profile", function (req, res) {

  console.log("inside return recived complete profile route");

  //send error status if request body is empty
  if (!req.body) return res.sendStatus(400);

  //received encrypted request body is assigned to a variable 
  var userConnections = req.body;

  //request body inside the variable profileInfo is decrypted using the crypto.js library's rabbit encryption algorithem 
  var byteString = CryptoJS.Rabbit.decrypt(userConnections, 'hfdsahgdajshgjdsahgjfafsajhkgs');

  //decrypted request body inside the variable byteString is converted to a string
  var information = byteString.toString(CryptoJS.enc.Utf8);

  //the request body string inside the information variable is parsed to a JSON Object
  var recievedConnectionObj = JSON.parse(information);

  //Query user's document and retrieve relevant element of receivedProfiles subdocument
  User.findOne({"userId": recievedConnectionObj.uid}, {receivedProfiles: {$elemMatch: {connectionId: recievedConnectionObj.connectionId}}}, function(err, result){
    if(err){
      console.log("Error "+err);
      return
    }
    var userInfo = [];//array to hold profile information of each recived profile
    
    var profiles = result.receivedProfiles[0].receivedProfileId;

  /* HCI Issues:         
  The time gap between the request and the response is noticibly high. Due to this reason the front-end UI components take time 
  to render as they need information from the server to dynamically create those components.

  Solutions: made the queries more efficient by querying only for a specific element in a subdocument rather than querying for the whole sub document and
  traversing through each of those elemnts and searching each one of them to find the needed element. This was achived by using $elemMatch match function
  given in the mongoose library.
  */
    
    //iterating through the profile ids recived
    for (let profile of profiles) {
      
      //querying for a pertivular profile of the profile sub document
      User.findOne({"userId": recievedConnectionObj.connectionId}, {profiles: {$elemMatch: {_profileId: profile}}},function(err, result){
        if(err) {
          console.log("Error "+err);
          return
        }
        //get information from the revant frofile and add into the userInfo array
        userInfo.push({
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
        
        /*if the elements in the array is equal to the number of profiles recives the objct with profile
        information will be sent to the client*/
        if (Object.keys(userInfo).length == profiles.length) {
          //making the array into a JSON object
          var profilesArray = JSON.stringify(userInfo);
          //encrypting the object using the secret key
          var encryptedObj = CryptoJS.Rabbit.encrypt(profilesArray, "hfdsahgdajshgjdsahgjfafsajhkgs");
         //sending the object as a response to the client
          res.json(encryptedObj);
          //invoking garbade collection to free memory 
          if (global.gc) {
              global.gc();
          } else {
              console.log("ERROR"+"garbade collection unavailable.");
          }
        }
        
        return
      });
    }
    return
  });

});



      /*
***************************************************************************************************************
* POST request handler for returning basic profiles of individuals with whome the user has shared profiles with
***************************************************************************************************************
*/

app.post("/device/connections/sent/publicprofile", function (req, res) {

  console.log("inside return connected user basic profile route");

   //send error status if request body is empty
  if (!req.body) return res.sendStatus(400);

  //received encrypted request body is assigned to a variable  
  var userConnections = req.body;

  //request body inside the variable profileInfo is decrypted using the crypto.js library's rabbit encryption algorithem 
  var byteString = CryptoJS.Rabbit.decrypt(userConnections, 'hfdsahgdajshgjdsahgjfafsajhkgs');

   //decrypted request body inside the variable byteString is converted to a string
  var information = byteString.toString(CryptoJS.enc.Utf8);

   //the request body string inside the information variable is parsed to a JSON Object
  var sharedConnectionObj = JSON.parse(information);

  //query for connectedUsers sub document of a perticular user
  User.findOne({ "userId": sharedConnectionObj.uid }, { "connectedUsers": 1, "_id": 0 }, function (err,result) {

    if(err){
      console.log("Error "+err);
      return
    }
  
    var profileInfo = [];  //array that holds basic information of all the connected users  
    var Users = result.connectedUsers;  
    
    //iterating through elemets of connectedUsers sub document
    for (let profile of Users) {  
        //querying for a user document whome the user has given a profile to
      User.findOne({ userId: profile.connectedUserId }, function (err,record) {  
        if(err){
          console.log("Error "+err);
          return
        }
        //add basic information of that user to the array
        profileInfo.push({ userId: record.userId, fName: record.fName, lName: record.lName, bio: record.bio });     
  
        if (Object.keys(profileInfo).length == Users.length) {  
          //making the array into a JSON object        
          var basicInfoArray = JSON.stringify(profileInfo);
          //encrypting the object using the secret key
          var encryptedObj = CryptoJS.Rabbit.encrypt(basicInfoArray, "hfdsahgdajshgjdsahgjfafsajhkgs");
          //sending the object as a response to the client
          res.json(encryptedObj);
          //invoking garbade collection to free memory 
          if (global.gc) {
            global.gc();
          } else {
            console.log("ERROR"+"garbade collection unavailable.");
          }
        }  
        return;  
    });  
    }
    return; 
  
  });
});



    /*
***************************************************************************
* //POST request handler for returning shared profile names to grant/revoke
***************************************************************************
*/

app.post("/device/connections/sent/grantrevoke/select", function (req, res) {
  console.log("inside grantrevoke select profiles route");

  //send error status if request body is empty
  if (!req.body) return res.sendStatus(400);

  //received encrypted request body is assigned to a variable  
  var grantRevokeSelect = req.body;

  //request body inside the variable profileInfo is decrypted using the crypto.js library's rabbit encryption algorithem 
  var byteString = CryptoJS.Rabbit.decrypt(grantRevokeSelect, 'hfdsahgdajshgjdsahgjfafsajhkgs');

   //decrypted request body inside the variable byteString is converted to a string
  var information = byteString.toString(CryptoJS.enc.Utf8);

  //the request body string inside the information variable is parsed to a JSON Object
  var grantRevokeSelectObj = JSON.parse(information);

/* HCI Issues:         
    The time gap between the request and the response is noticibly high. Due to this reason the front-end UI components take time 
    to render as they need information from the server to dynamically create those components.

    Solutions: made the queries more efficient by querying only for a specific element in a subdocument rather than querying for the whole sub document and
    traversing through each of those elemnts and searching each one of them to find the needed element. This was achived by using $elemMatch match function
    given in the mongoose library.
 */

  //quering for a specific element inside the connectedUsers sub documet
  User.findOne({"userId": grantRevokeSelectObj.uid}, {connectedUsers: {$elemMatch: {connectedUserId: grantRevokeSelectObj.connectedUserId}}}, function(err, result){
    if(err){
      console.log("Error "+err);
      return
    }
  
    var profArray = []; //array that holds information of all the profiles of the user
    
    var sharedProfiles = result.connectedUsers[0].sharedProfiles;
    
    //quering for all the profiles of the uer inside the profiles sub document
    User.findOne({"userId": grantRevokeSelectObj.uid}, {"profiles":1 },function(err, resultProfiles){
      if(err) {
        console.log("Error "+err);
        return
      }
  
      var AllProfiles = resultProfiles.profiles;
      
      //iterating through all the profiles the user hasand seetting granted status to false for all
      for(let prof of AllProfiles){
        profArray.push({
          profileName: prof.profileName, 
          grantedStatus: false, 
          _profileId: prof._profileId     
       });
      }
      
      //iterating through the profiles that were shared
     for(let sharedProf of sharedProfiles){
       for(var i=0; i < profArray.length; i++){
           /* if an id of a profile is found in the shared profile array the granted stats will be set 
           to true */
          var profileId = profArray[i]._profileId;
           
          if(profileId == sharedProf){
            profArray[i] = {
               profileName: profArray[i].profileName, 
               grantedStatus: true, 
               _profileId: profArray[i]._profileId     
            };                    
          }        
       }
      }
      //making the array into a JSON object
      var allProfArray = JSON.stringify(profArray); 
      //encrypting the object using the secret key
      var encryptedObj = CryptoJS.Rabbit.encrypt(allProfArray, "hfdsahgdajshgjdsahgjfafsajhkgs");
      //sending the object as a response to the client
      res.json(encryptedObj);
      //invoking garbade collection to free memory 
      if (global.gc) {
        global.gc();
      } else {
        console.log("ERROR"+"garbade collection unavailable.");
      }
      return;  
    });
    return;  
  }); 
});



  /*
**********************************************************************************************
* //POST request handler for handling granting/revoking of shared profiles to connected users
**********************************************************************************************
*/

app.post("/device/connections/sent/grantrevoke/handle", function (req, res) {

  console.log("inside handling granting revoking route");

  if (!req.body) return res.sendStatus(400);

  //Received request body that is encrypted
  var grantRevoke = req.body;

  //Request body is decrypted with the agreen upon key
  var bytes = CryptoJS.Rabbit.decrypt(grantRevoke, 'hfdsahgdajshgjdsahgjfafsajhkgs');

  //Decrypted request body is converted to plain text
  var plaintext = bytes.toString(CryptoJS.enc.Utf8);

  console.log(plaintext);

  //Request body is parsed to a JSON Object
  var grantRevokeObj = JSON.parse(plaintext);

  console.log(grantRevokeObj.uid + " " + grantRevokeObj.connectedUserId );   
 
  var modifiedProfiles = grantRevokeObj.modifiedProfiles;    

  var allowedProfilesArray = [];

  for (var i = 0; i < modifiedProfiles.length; i++) {
      if (modifiedProfiles[i].grantedStatus == true) {
        allowedProfilesArray.push(modifiedProfiles[i]._profileId);
      }
  }
  
  console.log("Allowed Profiles Array: " + allowedProfilesArray);

  /*
  * HCI ISSUE
  *===========================================================================
  * Granting and Revoking permissions to a certain connection is a time consuming process as there are changes to be made not only in the user's document
  * but also the connection's document. 
  * According to the HCI Principle of LATENCY REDUCTION, the client app has to be always quick to respond to the user's needs. Therefore, the issue of this lag has to be addressed.
  *
  * HOW THE HCI ISSUE WAS ADDRESSED
  *===========================================================================
  * Instead of iterating through a connected user's existing shared profiles and comparing the modified permissions in the request against the existing permissions, 
  * I delete the entire object from the subdocument and create a new object which is then pushed to the connectedUsers sub document. 
  * The same is done for the connection's document where the entire object regarding the user in the receivedProfiles sub document is deleted and a new object is created and pushed.
  * In this way, the use of loops and if conditions are abolished, thereby making the response faster.
  */

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

  //Querying for the relevant connection's document and pushing the updated allowed profiles to the receivedProfiles subdocument 
  User.findOne({ userId: grantRevokeObj.connectedUserId }).then(function(connectionRecord) {
    connectionRecord.receivedProfiles.push(newReceivedProfileObj);
    connectionRecord.save();
    console.log("Updated Received Profile saved successfully");
    /*Here the response is not encrypted as it is just a string value which the client will not be using for any further operations.
    * It is merely an acknowledgement
    */
    res.json("New Connection saved successfully");

    //Decommissioning of Data using Garbage Collection
    if (global.gc) {
      global.gc();
    } 
    else {
      console.log("Error in Garbage Collection: " );
    }
  });    
});


   /*
***************************************************************************
* //POST request handler for storing requests
***************************************************************************
*/

/* HCI Issues:
        if a very large amount of requests hit the server at the same time the server can crash
        as this issue was not addressed.
*/

app.post("/device/requests/store", function (req, res) {

  console.log("inside store request route");

  //send error status if request body is empty
  if (!req.body) return res.sendStatus(400);

  received = req.body;

  console.log( req.body);
  console.log(received.KONNECT_UID);

  /* HCI Issues:
      UI getting redundent reqests from the same user who is alreday connected thus causing confusing and misleading the user

  Solutions: 
      Queried for each of the places where the specific request Id can exist and compared with each entry and only entered the
      recieved request from a user who the client has not connected with before.
  */
  
  //quering for all elements in connectedUsers sub document
  User.findOne({ "userId": received.Device_ID }, { "connectedUsers": 1, "_id": 0 }, function (err,result1) {

    if(err){
      console.log("Error "+err);
      return;
    }
 
    var connectedUsers = result1.connectedUsers;
    
    var receivedRequests = [];

    // received.KONNECT_UID.map(String);

    var requestString = String(received.KONNECT_UID);

    console.log(JSON.parse(requestString));

    for(let i=0; i < received.KONNECT_UID.length; i++){
      receivedRequests.push(received.KONNECT_UID[i]);
      console.log("COUNTER"+i);
    }

    console.log(receivedRequests);
  
    for(let i=0; i < receivedRequests.length; i++){
        var output = receivedRequests[i].split(",");
        receivedRequests[i] = output[0];      
    }
  
    console.log(receivedRequests);
  
    //iteratig through elements in connectedUsers sub document
      for(let connecterUser of connectedUsers){
          //iterating through recived requests array
        for(let i=0; i < receivedRequests.length; i++){
          if(connecterUser.connectedUserId == receivedRequests[i] ){
              /*if a recived id is equal to the connected user id remove that id from the 
              receivedRequests array*/
            receivedRequests.splice(i, 1);
            break;
          }
        }
      }
  
    /*
  HCI issue:
    The time gap between the request and the response is noticibly high. Due to this reason the front-end UI components take time 
  to render as they need information from the server to dynamically create those components.
  
  Solution:
  improve the code logic to reduced the number of times the server has to 
  call the database to retrive information. Thus reducing latency of 
  acquiring data and sending them to the client
  */
    
    //query for a perticular users document
    User.findOne({ "userId":  received.Device_ID }, function (err,result) {  
      if(err){
        console.log("Error "+err);
        return
      }
  
      var currentReqests = result.requests
      console.log("CURRENT REQUESTS ARRAY " + currentReqests);
      var allRequests = [];
      
  
      //iterating through the reqests cueently in the requests sub document
      for(let request of currentReqests){
        for(let i=0; i < receivedRequests.length; i++){
          if(request.requesterId == receivedRequests[i] ){
            /*if a recived id is equal to a request id that is already there remove that id from the 
            receivedRequests array*/
            allRequests.push(request.requesterId);
            receivedRequests.splice(i, 1);
          }          
        }
      } 
      
      console.log("RECEIVED REQUESTS" + receivedRequests);
    
      //iterate through the receivedRequests array
      for(let newRequest of receivedRequests){
        allRequests.push(newRequest);
      }
  
      var schemizedRequests = [];
  
      for (let request of allRequests) {
        var element = new Request({
          requesterId: request
        });
        schemizedRequests.push(element);
        console.log("REQUEST IN ALLREQUESTS " + request);
        console.log("ELEMENT IN ALLREQUESTS " + element);
      }
  
      User.update(
        { userId: received.Device_ID},
        { $pull: { "requests": {} } },
        { safe: true},
        function(err, obj) {
          if (err) {
            console.log("EXISTING REQUESTS DID NOT GET DELETED! - " + err);
          }
      });
      
      User.update(
        { userId: received.Device_ID },
        { $set: { "requests":  schemizedRequests  } },
        { safe: true },
        function(err, obj) {
          if (err) {
            console.log("REQUEST DID NOT GET SAVED! - " + err);
          }

          res.send("Requests stored in database successfully!");
        });

      return
    });    
  return
  });
});
















// var received = { KONNECT_UID: ['6b1e2fa4096b4a55a9626af2598bf843,\n','6b1e2fa4096b4a55a9626af2598bf842,\n', '6b1e2fa4096b4a55a9626af2598bf841,\n', '6b1e2fa4096b4a55a9626af2598bf840'], Device_ID: 'eb38b3e831b944108e7d4db6f6d16298' };


// User.findOne({ "userId": received.Device_ID }, { "connectedUsers": 1, "_id": 0 }, function (err,result1) {

//   if(err){
//     console.log("Error "+err);
//     return
//   }

//   var receivedRequests = received.KONNECT_UID
//   var connectedUsers = result1.connectedUsers
//   // var receivedProfiles = result1.receivedProfiles

//   for(let i=0; i < receivedRequests.length; i++){
//       var output = receivedRequests[i].split(",");
//       receivedRequests[i] = output[0];      
//   }

//   console.log(receivedRequests);

//   //iteratig through elements in connectedUsers sub document
//     for(let connecterUser of connectedUsers){
//         //iterating through recived requests array
//       for(let i=0; i < receivedRequests.length; i++){
//         if(connecterUser.connectedUserId == receivedRequests[i] ){
//             /*if a recived id is equal to the connected user id remove that id from the 
//             receivedRequests array*/
//           receivedRequests.splice(i, 1);
//           break;
//         }
//       }
//     }

//   /*
// HCI issue:
//   The time gap between the request and the response is noticibly high. Due to this reason the front-end UI components take time 
// to render as they need information from the server to dynamically create those components.

// Solution:
// improve the code logic to reduced the number of times the server has to 
// call the database to retrive information. Thus reducing latency of 
// acquiring data and sending them to the client
// */
  
//   //query for a perticular users document
//   User.findOne({ "userId":  received.Device_ID }, function (err,result) {  
//     if(err){
//       console.log("Error "+err);
//       return
//     }

//     var currentReqests = result.requests
//     console.log("CURRENT REQUESTS ARRAY " + currentReqests);
//     var allRequests = [];
    

//     //iterating through the reqests cueently in the requests sub document
//     for(let request of currentReqests){
//       for(let i=0; i < receivedRequests.length; i++){
//         if(request.requesterId == receivedRequests[i] ){
//             /*if a recived id is equal to a request id that is already there remove that id from the 
//           receivedRequests array*/
//           allRequests.push(request.requesterId);
//           receivedRequests.splice(i, 1);
//         }          
//       }
//     }
    
  
//     //iterate through the receivedRequests array
//     for(let newRequest of receivedRequests){
//       allRequests.push(newRequest);
//     }

//     var schemizedRequests = [];

//     for (let request of allRequests) {
//       var element = new Request({
//         requesterId: request
//       });
//       schemizedRequests.push(element);
//       console.log("REQUEST IN ALLREQUESTS " + request);
//       console.log("ELEMENT IN ALLREQUESTS " + element);
//     }

//     User.update(
//       { userId: received.Device_ID},
//       { $pull: { "requests": {} } },
//       { safe: true},
//       function(err, obj) {
//         if (err) {
//           console.log("EXISTING REQUESTS DID NOT GET DELETED! - " + err);
//         }
//     });
    
//     User.update(
//       { userId: received.Device_ID },
//       { $set: { "requests":  schemizedRequests  } },
//       { safe: true },
//       function(err, obj) {
//         if (err) {
//           console.log("REQUEST DID NOT GET SAVED! - " + err);
//         }
//       });
    
//     return
//   });    
// return
// });