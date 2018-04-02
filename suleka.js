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
* GLOBALLY DECLARE BODY PARSER 
*******************************************************
*/

app.use(bodyParser.json());//to parse json request bodies
app.use(bodyParser.urlencoded({ extended: false }));//to parse urlencoded request bodies


/*
******************************************************* 
* DEFINING SCHEMA STRUCTURES
*******************************************************
*/

var Schema = mongoose.Schema;//declaring schema from the mongoose library 

  //schema for received profiles from users who have connected with another perticular user
var receivedProfilesSchema = new Schema({
    _id: false,
    connectionId: String, //Requesters ID
    receivedProfileId: { type: Array, "default": [] }
});
  
  //schema for connection requests
var requestsSchema = new Schema({
    _id: false,
    requesterId: String
});

  //schema for the user profile
  //defining profilesSchema,requestsSchema,connectedUsersSchema and receivedProfilesSchema as subdocuments of users inorer to reduce data redundancy 
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


  /*
****************************************************************
* DECLARING MODELS BASED ON THE SCHEMAS MADE
****************************************************************
*/

//model  for the user collection
var User = mongoose.model("users", usersSchema);
//model for the request subdocument
var Request = mongoose.model("requests", requestsSchema);
//model for the received profile subdocument
var ReceivedProfile = mongoose.model("receivedProfiles", receivedProfilesSchema);


/*
******************************************************* 
* ROUTES
*******************************************************
*/


//POST request handler for creating a profile
app.post("/profiles/create", function (req, res) {

    console.log("inside createProfile route");
  
    //send error status if request body is empty
    if (!req.body) return res.sendStatus(400);
  
    //Received request body that is encrypted
    var profileInfo = req.body;
  
    //Request body is decrypted using 
    var bytes = CryptoJS.Rabbit.decrypt(profileInfo, 'hfdsahgdajshgjdsahgjfafsajhkgs');
  
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

