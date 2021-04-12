const functions = require("firebase-functions");
const axios = require("axios");
const admin = require("firebase-admin");
admin.initializeApp();

exports.productSync = functions
  .region("australia-southeast1")
  .pubsub.schedule("every 2 hours")
  .onRun(async (context) => {
    try {
      axios.defaults.headers.common["x-v"] = "2";
      const response = await axios.get("https://api.commbank.com.au/public/cds-au/v1/banking/products");
      const products = response.data.data.products;
      if (products.length && products.length > 0) {
        await Promise.all(products.map(async (p) => {
          const productRef = admin.firestore().collection("products")
            .doc(p.productId);
          const snapshot = await productRef.get();
          if (snapshot.exists) {
            const storedProduct = snapshot.data();
            if (p.lastUpdated !== storedProduct.lastUpdated) {
              await productRef.set(p);
              console.log(`Product '${p.name}' (${p.productId}) is updated`);
            } else {
              console.log(`Product '${p.name}' (${p.productId}) is skipped, no changes since last update`);
            }
          } else {
            await productRef.set(p);
            console.log(`Product '${p.name}' (${p.productId}) is added`);
          }
        }));
      } else {
        console.log("Unable to parse products from api");
      }
    } catch (error) {
      console.log("There was an error while trying to sync products");
    }
  });
