const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {aggregate} = require("./lib/aggregate");
const {aggregateMany} = require("./lib/aggregateMany");
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
exports.sync_products_for_banks_1st_batch = functions
  .region(REGION)
  .pubsub.schedule("0 10 * * *")
  .onRun(async (context) => {
    await syncProductForMultipleBanks(db, ["cba", "anz", "nab"]);
  });

/**
 * Sync products for WESTPAC, BANKWEST at 3:02am
 */
exports.sync_products_for_banks_2nd_batch = functions
  .region(REGION)
  .pubsub.schedule("2 10 * * *")
  .onRun(async (context) => {
    await syncProductForMultipleBanks(db, ["wbc", "bw"]);
  });

/**
 * Sync product details at 3:30am
 */
exports.sync_product_details_1st_run = functions
  .region(REGION)
  .pubsub.schedule("30 10 * * *")
  .onRun(async (context) => {
    await syncProductDetails(db);
  });

/**
 * Sync product details 2nd run at 3:35am
 * This is due to the 1st run may encounter some 429 errors
 * from the bank's api when fetching product details (too many requests)
 */
exports.sync_product_details_2nd_run = functions
  .region(REGION)
  .pubsub.schedule("35 10 * * *")
  .onRun(async (context) => {
    await syncProductDetails(db, "sequential");
  });

/**
 * Count product brands at 4:00am
 */
exports.count_product_brands = functions
  .region(REGION)
  .pubsub.schedule("0 11 * * *")
  .onRun(async (context) => {
    await aggregate(
      db,
      "products",
      (doc) => doc.productId,
      "productBrands",
      (doc) => doc.brand,
      (aggregate, doc) => ({productCount: aggregate.productCount + 1}),
      (doc) => ({productCount: 1, name: doc.brand}),
    );
  });

/**
 * Count product categories at 4:02am
 */
exports.count_product_categories = functions
  .region(REGION)
  .pubsub.schedule("2 11 * * *")
  .onRun(async (context) => {
    await aggregate(
      db,
      "products",
      (doc) => doc.productId,
      "productCategories",
      (doc) => doc.productCategory,
      (aggregate, doc) => ({productCount: aggregate.productCount + 1}),
      (doc) => ({
        productCount: 1,
        name: doc.productCategory,
        type: parseCategoryType(doc.productCategory),
      }),
    );
  });

/**
 * Count product eligibility at 4:04am
 */
exports.count_product_eligibility = functions
  .region(REGION)
  .pubsub.schedule("4 11 * * *")
  .onRun(async (context) => {
    await aggregateMany(
      db,
      "products",
      (doc) => doc.productId,
      (doc, targetDocId) => (doc.eligibility || []).find((e) => e.eligibilityType === targetDocId),
      "productEligibility",
      (doc) => (doc.eligibility || []).map((x) => x.eligibilityType),
      (aggregate, element) => ({
        productCount: aggregate.productCount + 1
      }),
      (element) => ({
        productCount: 1,
        name: element.eligibilityType,
      }),
    );
  });

/**
 * Count product features at 4:06am
 */
exports.count_product_features = functions
  .region(REGION)
  .pubsub.schedule("6 11 * * *")
  .onRun(async (context) => {
    await aggregateMany(
      db,
      "products",
      (doc) => doc.productId,
      (doc, targetDocId) => (doc.features || []).find((e) => e.featureType === targetDocId),
      "productFeatures",
      (doc) => (doc.features || []).map((x) => x.featureType),
      (aggregate, element) => ({
        productCount: aggregate.productCount + 1
      }),
      (element) => ({
        productCount: 1,
        name: element.featureType,
      }),
    );
  });

/**
 * Count product constraints at 4:08am
 */
exports.count_product_constraints = functions
  .region(REGION)
  .pubsub.schedule("8 11 * * *")
  .onRun(async (context) => {
    await aggregateMany(
      db,
      "products",
      (doc) => doc.productId,
      (doc, targetDocId) => (doc.constraints || []).find((e) => e.constraintType === targetDocId),
      "productConstraints",
      (doc) => (doc.constraints || []).map((x) => x.constraintType),
      (aggregate, element) => ({
        productCount: aggregate.productCount + 1
      }),
      (element) => ({
        productCount: 1,
        name: element.constraintType,
      }),
    );
  });