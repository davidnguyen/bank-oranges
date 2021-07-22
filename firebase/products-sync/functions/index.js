const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {aggregate} = require("./lib/aggregate");
const {syncProductForBank} = require("./lib/syncProduct");
const {parseCategoryType} = require("./lib/utils");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();
const REGION = "australia-southeast1";

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
          type: parseCategoryType(productDetails.productCategory),
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
      "countProductBrands",
      "products",
      "productBrands",
      (doc) => doc.brand,
      (previous, doc) => ({
        ...previous,
        productCount: previous.productCount + 1,
        products: [...previous.products, doc.productId],
      }),
      (doc) => ({name: doc.brand, productCount: 1, products: [doc.productId]}),
    );
  });

exports.countProductCategories = functions
  .region(REGION)
  .pubsub.schedule("2 11 * * *")
  .onRun(async (context) => {
    await aggregate(
      db,
      "countProductCategories",
      "products",
      "productCategories",
      (doc) => doc.productCategory,
      (previous, doc) => ({
        ...previous,
        productCount: previous.productCount + 1,
        products: [...previous.products, doc.productId],
      }),
      (doc) => ({
        name: doc.productCategory,
        type: parseCategoryType(doc.productCategory),
        productCount: 1,
        products: [doc.productId],
      }),
    );
  });
