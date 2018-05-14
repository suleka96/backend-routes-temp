
/******************************************************** 
* DEFINE PATHS
********************************************************/

app.use(express.static(path.join(__dirname, "public"))); //Define path for static assets
app.set("views", path.join(__dirname, "views")); //Define path for views
app.set("view engine", "ejs"); //Define view engine as EJS
app.use(cors());
mongoose.Promise = global.Promise; //Declare mongoose promises globally


/******************************************************** 
* SET PORT
********************************************************/

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


/******************************************************** 
* CONNECTION TO DATABASE
********************************************************/

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


/******************************************************** 
* DEFINE SCHEMAS AND CREATE MODELS FOR COLLECTIONS
********************************************************/

// Define Schema from Mongoose
var Schema = mongoose.Schema;

//Mongo Database schema for user profiles
var profilesSchema = new Schema({
  _id: false, // _id is set to false to stop mongoose from creating an ObjectID by default
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
  _id: false, // _id is set to false to stop mongoose from creating an ObjectID by default
  connectedUserId: String,
  sharedProfiles: { type: Array, "default": [] }
});

//Declaring models for database based on schemas made above
var Profile = mongoose.model("profiles", profilesSchema);
var ConnectedUsers = mongoose.model("connectedUsers", connectedUsersSchema);


/******************************************************** 
* DEFINE ROUTES
********************************************************/

//GET request handler for index route
app.get("/", (req, res) => res.render("pages/index"));


/*
* SECURITY RISKS
*===========================================================================
* Each of the below mentioned routes handle POST requests from the client.
* As per the security risks to data in motion, we understand that data could be stolen by unauthorized third parties through  and similar attacks.
* Data could also be manipulated and corrupted while in transit.
*
* HOW THE SECURITY RISKS WERE ADDRESSED
*===========================================================================
* Encryption has been used to secure the request and response bodies(objects) both.
* The encryption library used is CryptoJS with the cipher algorithm Rabbit.
* 
* Garbage Collection has also been requested at the end of each route to aid in decommissioning of data in memory.
*/

//POST request handler for register route
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

//POST request handler for editing profiles
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
            console.log("Error in Garbage Collection: " + ex);
        }
      }
    });    
});

//POST request handler for sending profiles
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
            console.log("Error in Garbage Collection: " + ex);
          }
        }
      });
    
});

//POST request handler for returning public profile of requests
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
  
    //User document is queried for the requests sub document
    User.findOne({ "userId": requestInfoObj.uid }, { "requests": 1, "_id": 0 }).then(function (result) {
      console.log("Retrieved Requests Object from DB: " + result);
  
      //Retrieved object is converted to a JSON String from the retrieved BSON
      var BSONObj = JSON.stringify(result);
      //JSON String is converted to JS Object for internal use
      var parsedJSObj = JSON.parse(BSONObj);
  
      var array = [];
  
      //Iterate through each of the requesterIds
      for (var i = 0; i < parsedJSObj.requests.length; i++) {
  
        console.log("Requester ID: " + i + ": " + parsedJSObj.requests[i].requesterId);
  
        //Query each requesterId for their public profile and push it into an array which is then returned to the front end
        User.findOne({ userId: parsedJSObj.requests[i].requesterId }).then(function (record) {
          console.log("profile retrieved successfully");
          //Each requester's public profile is pushed to an array
          array.push({ 
            userId: record.userId, 
            fName: record.fName, 
            lName: record.lName, 
            bio: record.bio 
          });
          console.log("resultttttttttttt" + JSON.stringify(array));
        }).then(function () {
          //If the number of public profile objects are equal to the number of requesterIds, the array is sent to the front end as a response
          if (Object.keys(array).length == parsedJSObj.requests.length) {
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
                console.log("Error in Garbage Collection: " + ex);
            }
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
        console.log("Error in Garbage Collection: " + ex);
    }
});

//POST request handler for returning recieved connections public profile
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
          if (Object.keys(array).length == Users.length) {
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
                console.log("Error in Garbage Collection: " + ex);
            }
          }  
          return 
        });  
      }
      return 
    });
    
});

//POST request handler for handling granting/revoking of shared profiles to connected users
app.post("/device/connections/sent/grantrevoke/handle", function (req, res) {
    console.log("inside handling granting revoking route");
  
    if (!req.body) return res.sendStatus(400);
  
    //Received request body that is encrypted
    var grantRevoke = req.body;
  
    //Request body is decrypted with the agreen upon key
    var bytes = CryptoJS.Rabbit.decrypt(grantRevoke, 'hfdsahgdajshgjdsahgjfafsajhkgs');
  
    //Decrypted request body is converted to plain text
    var plaintext = bytes.toString(CryptoJS.enc.Utf8);
  
    //Request body is parsed to a JSON Object
    var grantRevokeObj = JSON.parse(plaintext);
  
    console.log("Request Sent: " + grantRevokeObj);     
   
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
        console.log("Error in Garbage Collection: " + ex);
      }
    });    
});

/*******************************************************************************************************************************/