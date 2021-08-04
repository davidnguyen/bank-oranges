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
    await syncProductForMultipleBanks(db, ["westpac", "bankwest", "virgin"]);
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
      (aggregate, doc) => ({
        count: aggregate.count + 1,
        categories: [...new Set([...aggregate.categories, doc.productCategory])],
      }),
      (doc) => ({
        name: doc.brandName ? doc.brandName : doc.brand,
        count: 1,
        categories: [doc.productCategory],
      }),
    );
  });

/**
 * Count product categories at 4:02am
 */
exports.count_product_categories = functions
  .region(REGION)
  .pubsub.schedule("2 11 * * *")
  .onRun(async (context) => {
    const featureTypesMapper = (doc) => (doc.features || []).map((x) => x.featureType);
    const feeTypesMapper = (doc) => (doc.fees || []).map((x) => x.feeType);
    const eligibilityTypesMapper = (doc) => (doc.eligibility || []).map((x) => x.eligibilityType);
    const constraintTypesMapper = (doc) => (doc.constraints || []).map((x) => x.constraintType);
    const lendingRateTypesMapper = (doc) => (doc.lendingRates || []).map((x) => x.lendingRateType);
    const depositRateTypesMapper = (doc) => (doc.depositRates || []).map((x) => x.depositRateType);

    await aggregate(
      db,
      "products",
      (doc) => doc.productId,
      "productCategories",
      (doc) => doc.productCategory,
      (aggregate, doc) => ({
        count: aggregate.count + 1,
        featureTypes: [...new Set([...aggregate.featureTypes, ...featureTypesMapper(doc)])],
        feeTypes: [...new Set([...aggregate.feeTypes, ...feeTypesMapper(doc)])],
        eligibilityTypes: [...new Set([...aggregate.eligibilityTypes, ...eligibilityTypesMapper(doc)])],
        constraintTypes: [...new Set([...aggregate.constraintTypes, ...constraintTypesMapper(doc)])],
        lendingRateTypes: [...new Set([...aggregate.lendingRateTypes, ...lendingRateTypesMapper(doc)])],
        depositRateTypes: [...new Set([...aggregate.depositRateTypes, ...depositRateTypesMapper(doc)])],
      }),
      (doc) => ({
        name: doc.productCategory,
        type: parseCategoryType(doc.productCategory),
        count: 1,
        featureTypes: [...new Set(featureTypesMapper(doc))],
        feeTypes: [...new Set(feeTypesMapper(doc))],
        eligibilityTypes: [...new Set(eligibilityTypesMapper(doc))],
        constraintTypes: [...new Set(constraintTypesMapper(doc))],
        lendingRateTypes: [...new Set(lendingRateTypesMapper(doc))],
        depositRateTypes: [...new Set(depositRateTypesMapper(doc))],
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
      (aggregate, doc, element) => ({
        count: aggregate.count + 1,
      }),
      (doc, element) => ({
        count: 1,
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
      (aggregate, doc, element) => ({
        count: aggregate.count + 1,
      }),
      (doc, element) => ({
        count: 1,
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
      (aggregate, doc, element) => ({
        count: aggregate.count + 1,
      }),
      (doc, element) => ({
        count: 1,
        name: element.constraintType,
      }),
    );
  });

/**
 * Count product lending rates at 4:10am
 */
exports.count_product_lending_rates = functions
  .region(REGION)
  .pubsub.schedule("10 11 * * *")
  .onRun(async (context) => {
    await aggregateMany(
      db,
      "products",
      (doc) => doc.productId,
      (doc, targetDocId) => (doc.lendingRates || []).find((e) => e.lendingRateType === targetDocId),
      "productLendingRates",
      (doc) => (doc.lendingRates || []).map((x) => x.lendingRateType),
      (aggregate, doc, element) => ({
        count: aggregate.count + 1,
        tiers: [...new Set([...aggregate.tiers, ...(element.tiers ||[]).map((t) => t.unitOfMeasure)])],
      }),
      (doc, element) => ({
        name: element.lendingRateType,
        count: 1,
        tiers: [...new Set((element.tiers ||[]).map((t) => t.unitOfMeasure))],
      }),
    );
  });

/**
 * Count product deposit rates at 4:12am
 */
exports.count_product_deposit_rates = functions
  .region(REGION)
  .pubsub.schedule("12 11 * * *")
  .onRun(async (context) => {
    await aggregateMany(
      db,
      "products",
      (doc) => doc.productId,
      (doc, targetDocId) => (doc.depositRates || []).find((e) => e.depositRateType === targetDocId),
      "productDepositRates",
      (doc) => (doc.depositRates || []).map((x) => x.depositRateType),
      (aggregate, doc, element) => ({
        count: aggregate.count + 1,
        tiers: [...new Set([...aggregate.tiers, ...(element.tiers ||[]).map((t) => t.unitOfMeasure)])],
      }),
      (doc, element) => ({
        name: element.depositRateType,
        count: 1,
        tiers: [...new Set((element.tiers ||[]).map((t) => t.unitOfMeasure))],
      }),
    );
  });
