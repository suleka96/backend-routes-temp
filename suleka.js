/*
Security:

    risks:
        data in motion, in memory and at rest is vulnerable to unauthorised access. 
        Malicious 3rd party individuals or software can monitor, extract or tamper with the confidential data using variouse methods.


    How it is addressed:

        Only an encrypted objected of data is recived as a request and also sent as a response to ensure that data sent or recieved by 
        the server cannot be altered or taken by a third party while being transmitted to the server

        For the decryption and encryption process a secret key is required which is only known by the client and the server, this further
        ensures the security of the data as even if a third party access the data while it is being transmitted, they
        will not be able to decrypt the information without the key. 


*/


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
*************************************************************************************************************
*                                           ROUTES
*************************************************************************************************************
*/


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
    User.findOne({ userId: profObj.uid }).then(function (record) {
        record.profiles.push(profile);
        record.save();
        console.log("New Profile saved successfully");
        res.json("New Profile saved successfully");// sending success message string back to the client
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
      { $pull: { profiles: { _profileId: delProfObj.profId } } },
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
        });
        
        return;
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
      }
    });
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
        }  
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
    User.findOne({"userId": recievedConnectionObj.uid}, {receivedProfiles: {$elemMatch: {connectionId: requestConnectionObj.connectionId}}}, function(err, result){
      if(err){
        console.log("Error "+err);
        return
      }
      var userInfo = [];//array to hold profile information of each recived profile
      
      var profiles = result.receivedProfiles[0].receivedProfileId;
      
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
          if(profArray[i]._profileId == sharedProf ){
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
      return  
    });
    return  
  }); 
});
  

   /*
***************************************************************************
* //POST request handler for storing requests
***************************************************************************
*/

app.post("/device/requests/store", function (req, res) {

    console.log("inside store request route");

    //send error status if request body is empty
    if (!req.body) return res.sendStatus(400);
  
    //received encrypted request body is assigned to a variable  
    var grantRevoke = req.body;
  
    //request body inside the variable profileInfo is decrypted using the crypto.js library's base 64 encryption algorithem 
    var byteString = CryptoJS.Base64.decrypt(grantRevoke, 'hfdsahgdajshgjdsahgjfafsajhkgs');
  
    //decrypted request body inside the variable byteString is converted to a string
    var information = byteString.toString(CryptoJS.enc.Utf8);
  
    //the request body string inside the information variable is parsed to a JSON Objectt
    var reqestObj = JSON.parse(information);
  
    received = reqestObj;
    
    //quering for all elements in connectedUsers sub document
    User.findOne({ "userId": received.uid }, { "connectedUsers": 1, "_id": 0 }, function (err,result1) {
  
      if(err){
        console.log("Error "+err);
        return
      }
    
      receivedRequests = received.sharedProfiles
      connectedUsers = result1.connectedUsers
    
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
      
      //query for a perticular users document
      User.findOne({ "userId":  received.uid }, function (err,result) {
    
        if(err){
          console.log("Error "+err);
          return
        }

        currentReqests = result.requests
        
        //iterating through the reqests cueently in the requests sub document
        for(let request of currentReqests){
          for(let i=0; i < receivedRequests.length; i++){
            if(request.requesterId == receivedRequests[i] ){
                /*if a recived id is equal to a request id that is already there remove that id from the 
              receivedRequests array*/
              receivedRequests.splice(i, 1);
            }
            
          }
        }
        
        //iterate through the receivedRequests array
        for(let newRequest of receivedRequests){
          var element={requesterId: newRequest};
          result.requests.push(element);//adding request to the requests sub document
          result.save();
          console.log("saved "+ element);
        }
    
        res.send("success");//sending a success response to the client if request was successfully added
        return
  
      });    
    return
    });
  });