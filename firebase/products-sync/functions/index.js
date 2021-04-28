const functions = require("firebase-functions");
const axios = require("axios");
const admin = require("firebase-admin");
admin.initializeApp();

exports.productSync = functions
  .region("australia-southeast1")
  .pubsub.schedule("every 8 hours")
  .onRun(async (context) => {
    axios.defaults.headers.common["x-v"] = "2";
    try {
      const banksQuery = await admin.firestore().collection("banks").get();
      await Promise.all(banksQuery.docs.map(async (bankSnapshot) => {
        const bank = bankSnapshot.data();
        console.log(`Sync products from ${bank.name}`);
        const response = await axios.get(`${bank.apiBaseUrl}/products`);
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
          console.error("Unable to parse products from api");
        }
      }));
    } catch (error) {
      console.error("There was an error while trying to sync products", error);
    }
  });
