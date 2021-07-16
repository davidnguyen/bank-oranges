const functions = require("firebase-functions");
const axios = require("axios");
const admin = require("firebase-admin");

admin.initializeApp();

const REGION = "australia-southeast1";
const LEASE_TIME = 60 * 1000; // 60 seconds

const syncProductForBank = async (bankId) => {
  try {
    // Retrieve bank record from firestore
    const bankRef2 = admin.firestore().collection("banks").doc(bankId);
    const bankSnapshot = await bankRef2.get();

    if (bankSnapshot.exists) {
      let page = 1;
      let totalPages = 1;
      const bank = bankSnapshot.data();

      // Set API version number configured in the bank record
      axios.defaults.headers.common["x-v"] = bank.xv;

      // Iterate through every product pages
      while (page <= totalPages) {
        const response = await axios.get(`${bank.apiBaseUrl}/products?page=${page}`)
          .catch((error) => {
            functions.logger.error(`Unable to retrieve products for ${bankId} on page ${page}`, error);
          });
        const products = response.data.data.products;

        totalPages = response.data.meta.totalPages;

        functions.logger.log(`Processing products page ${page} out of ${totalPages}`);

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

        page = page + 1;
      }
    } else {
      console.error(`Bank ${bankId} does not exist`);
    }
  } catch (error) {
    functions.logger.error("There was an error while trying to sync products", error);
  }
};

exports.productSyncForCBA = functions
  .region(REGION)
  .pubsub.schedule("every 8 hours")
  .onRun(async (context) => {
    await syncProductForBank("cba");
  });

exports.productSyncForANZ = functions
  .region(REGION)
  .pubsub.schedule("every 8 hours")
  .onRun(async (context) => {
    await syncProductForBank("anz");
  });

exports.productSyncForNAB = functions
  .region(REGION)
  .pubsub.schedule("every 8 hours")
  .onRun(async (context) => {
    await syncProductForBank("nab");
  });

exports.productSyncForWestpac = functions
  .region(REGION)
  .pubsub.schedule("every 8 hours")
  .onRun(async (context) => {
    await syncProductForBank("wbc");
  });

exports.productCategoryCounter = functions
  .region(REGION)
  .firestore
  .document("products/{productId}")
  .onCreate(async (snapshot, context) => {
    const db = admin.firestore();
    const eventId = context.eventId;
    const product = snapshot.data();
    const eventReceiptRef = db.collection("eventReceipts").doc(eventId);
    const eventHint = "productCategoryCounter";

    await db.runTransaction(async (transaction) => {
      const eventReceiptSnapshot = await transaction.get(eventReceiptRef);

      if (eventReceiptSnapshot.exists && eventReceiptSnapshot.data().done) {
        console.log("Event already processed");
        return;
      }

      if (eventReceiptSnapshot.exists && new Date() < eventReceiptSnapshot.data().lease) {
        console.log("Event is being processed by another instance of the function and lease is not expired");
        return;
      }

      // Event has never been processed, or attempted to process in the past but not successful and lease is expired
      // Create a new lease
      transaction.set(eventReceiptRef, {lease: new Date(new Date().getTime() + LEASE_TIME), hint: eventHint});

      const productCategoryCountRef = db.collection("productCategoryCounts").doc(product.productCategory);
      const productCategoryCountSnapshot = await productCategoryCountRef.get();

      if (productCategoryCountSnapshot.exists) {
        // productCategoryCount already exist -> update count + 1
        const productCategoryCount = productCategoryCountSnapshot.data();
        productCategoryCount.productCount += 1;
        productCategoryCount.products = [...productCategoryCount.products, product.productId];
        transaction.set(productCategoryCountRef, productCategoryCount);
      } else {
        // productCategoryCount does not exist -> create, set count = 1
        transaction.set(productCategoryCountRef, {productCount: 1, products: [product.productId]});
      }

      // Set lease to done
      transaction.set(eventReceiptRef, {done: true, hint: eventHint});
    });
  });
