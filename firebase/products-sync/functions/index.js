const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {aggregate} = require("./lib/aggregate");
const {syncProductForBank} = require("./lib/syncProduct");
const axios = require("axios");

admin.initializeApp();

const REGION = "australia-southeast1";
const db = admin.firestore();

/*
  Schedule:
    0 10 * * * -> Everyday at
      10:00am Los Angeles, America or
      3:00am Melbourne, Australia time
*/

exports.productSyncCBA = functions
  .region(REGION)
  .pubsub.schedule("0 10 * * *")
  .onRun(async (context) => {
    await syncProductForBank(db, "cba");
  });

exports.productSyncANZ = functions
  .region(REGION)
  .pubsub.schedule("2 10 * * *")
  .onRun(async (context) => {
    await syncProductForBank(db, "anz");
  });

exports.productSyncNAB = functions
  .region(REGION)
  .pubsub.schedule("4 10 * * *")
  .onRun(async (context) => {
    await syncProductForBank(db, "nab");
  });

exports.productSyncWBC = functions
  .region(REGION)
  .pubsub.schedule("6 10 * * *")
  .onRun(async (context) => {
    await syncProductForBank(db, "wbc");
  });

exports.productSyncBWE = functions
  .region(REGION)
  .pubsub.schedule("8 10 * * *")
  .onRun(async (context) => {
    await syncProductForBank(db, "bw");
  });

exports.syncEventProductOnCreate = functions
  .region(REGION)
  .firestore
  .document("products/{productId}")
  .onCreate(async (snapshot, context) => {
    const document = snapshot.data();
    const syncEventRef = db.collection("syncEvents").doc(context.eventId);
    await syncEventRef.set({
      type: "products-on-create",
      docId: context.params.productId,
      document: document,
      consumers: [],
    });
  });

exports.fetchProductDetails = functions
  .region(REGION)
  .firestore
  .document("products/{productId}")
  .onWrite(async (change, context) => {
    try {
      if (!change.after.exists) {
        return;
      }

      const productId = context.params.productId;
      const product = change.after.data();

      if (product.meta.hasDetail) {
        return;
      }

      const bankId = product.meta.bank;
      const bankRef = db.collection("banks").doc(bankId);
      const bankSnapshot = await bankRef.get();

      if (!bankSnapshot.exists) {
        console.error(`Bank ${bankId} does not exist`);
        return;
      }

      const bank = bankSnapshot.data();
      axios.defaults.headers.common["x-v"] = bank.xv;
      axios.defaults.headers.common["Accept"] = "application/json";

      const response = await axios.get(
        `${bank.apiBaseUrl}/products/${productId}`);

      const productDetails = response.data.data;

      return change.after.ref.set({
        ...productDetails,
        meta: {
          ...product.meta,
          updated: new Date().toISOString(),
          hasDetail: true,
        },
      });
    } catch (error) {
      functions.logger.error(
        "There was an error while trying to fetch product details", error);
    }
  });

exports.countProductBrands = functions
  .region(REGION)
  .pubsub.schedule("0 11 * * *")
  .onRun(async (context) => {
    await aggregate(
      db,
      "aggregateProductBrands",
      "products-on-create",
      "productBrands",
      (doc) => doc.brand,
      (previous, doc) => ({
        productCount: previous.productCount + 1,
        products: [...previous.products, doc.productId],
      }),
      (doc) => ({productCount: 1, products: [doc.productId]}),
    );
  });

exports.countProductCategories = functions
  .region(REGION)
  .pubsub.schedule("2 11 * * *")
  .onRun(async (context) => {
    await aggregate(
      db,
      "aggregateProductCategories",
      "products-on-create",
      "productCategories",
      (doc) => doc.productCategory,
      (previous, doc) => ({
        productCount: previous.productCount + 1,
        products: [...previous.products, doc.productId],
      }),
      (doc) => ({productCount: 1, products: [doc.productId]}),
    );
  });
