const functions = require("firebase-functions");
const axios = require("axios");

exports.helloWorld = functions
  .region("australia-southeast1")
  .https.onRequest((request, response) => {
    response.send("Hello from Firebase!");
  });

exports.productSync = functions
  .region("australia-southeast1")
  .pubsub.schedule("every 30 minutes")
  .onRun((context) => {
    axios.defaults.headers.common["x-v"] = "2";
    axios.get("https://api.commbank.com.au/public/cds-au/v1/banking/products")
      .then(function(response) {
        console.log("Found some data");
      })
      .catch(function(error) {
        console.log("There was an error while trying to sync products");
      });
  });
