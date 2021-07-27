const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {aggregate} = require("./lib/aggregate");
const {syncProductForMultipleBanks} = require("./lib/syncProductForBank");
const {syncProductDetails} = require("./lib/syncProductDetails");
const {parseCategoryType} = require("./lib/utils");

admin.initializeApp();
const db = admin.firestore();
const REGION = "australia-southeast1";

/*
  Schedule:
    0 10 * * * -> Everyday at
      10:00am Los Angeles, America or
      3:00am Melbourne, Australia time
*/

/**
 * Sync products for CBA, ANZ and NAB at 3:00am
 */
exports.syncProductFor_CBA_ANZ_NAB = functions
  .region(REGION)
  .pubsub.schedule("0 10 * * *")
  .onRun(async (context) => {
    await syncProductForMultipleBanks(db, ["cba", "anz", "nab"]);
  });

/**
 * Sync products for WESTPAC, BANKWEST at 3:02am
 */
exports.syncProductFor_WESTPAC_BANKWEST = functions
  .region(REGION)
  .pubsub.schedule("2 10 * * *")
  .onRun(async (context) => {
    await syncProductForMultipleBanks(db, ["wbc", "bw"]);
  });

/**
 * Sync product details at 3:30am
 */
exports.syncPrductDetails = functions
  .region(REGION)
  .pubsub.schedule("30 10 * * *")
  .onRun(async (context) => {
    await syncProductDetails(db);
  });

/**
 * Sync product details 2nd try at 3:35am
 * This is due to the 1st try may encounter some 429 errors
 * from the bank's api when fetching product details (too many requests)
 */
exports.syncPrductDetails = functions
  .region(REGION)
  .pubsub.schedule("35 10 * * *")
  .onRun(async (context) => {
    await syncProductDetails(db);
  });

/**
 * Count product brands at 4:00am
 */
exports.countProductBrands = functions
  .region(REGION)
  .pubsub.schedule("0 11 * * *")
  .onRun(async (context) => {
    await aggregate(
      db,
      "products",
      (doc) => doc.productId,
      "productBrands",
      (doc) => doc.brand,
      (previous, doc) => ({productCount: previous.productCount + 1}),
      (doc) => ({productCount: 1}),
    );
  });

/**
 * Count product categories at 4:02am
 */
exports.countProductCategories = functions
  .region(REGION)
  .pubsub.schedule("2 11 * * *")
  .onRun(async (context) => {
    await aggregate(
      db,
      "products",
      (doc) => doc.productId,
      "productCategories",
      (doc) => doc.productCategory,
      (previous, doc) => ({productCount: previous.productCount + 1}),
      (doc) => ({productCount: 1, type: parseCategoryType(doc.productCategory)}),
    );
  });
