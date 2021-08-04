const axios = require("axios");
const https = require("https");
const functions = require("firebase-functions");
const {parseCategoryType} = require("./utils");

/**
 * Sync propduct details
 * @param {FirebaseFirestore.Firestore} db Firestore database
 * @param {"parallel"|"sequential"} mode Run mode, either "parallel" or "sequential"
 */
exports.syncProductDetails = async (db, mode = "parallel") => {
  const syncErrors = [];
  const syncSuccesses = [];
  const productQuerySnapshot = await db.collection("products")
    .where("meta.hasDetail", "==", false).get();

  const totalProductForSync = productQuerySnapshot.size;
  functions.logger.info(
    `${totalProductForSync} product(s) need to sync for details`);

  if (totalProductForSync === 0) {
    return;
  }

  if (mode === "parallel") {
    await Promise.all(productQuerySnapshot.docs.map(async (productSnapshot) => {
      const [success, error] = await syncProduct(productSnapshot, db);
      if (success) syncSuccesses.push(success);
      if (error) syncErrors.push(error);
    }));
  } else {
    for (const productSnapshot of productQuerySnapshot.docs) {
      const [success, error] = await syncProduct(productSnapshot, db);
      if (success) syncSuccesses.push(success);
      if (error) syncErrors.push(error);
    }
  }

  if (syncErrors.length > 0) {
    functions.logger.error("There were some errors while syncing product details", syncErrors);
  }

  functions.logger.info(`${syncSuccesses.length} of ${totalProductForSync} sync successfully, with ${syncErrors.length} errors.`);
};

/**
 * Sync a single product
 * @param {FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>} productSnapshot
 * @param {FirebaseFirestore.Firestore} db Firestore database
 * @returns {[String, Object]} Success or error message
 */
const syncProduct = async (productSnapshot, db) => {
  let syncError = null;
  let syncSuccess = null;
  const product = productSnapshot.data();

  try {
    const bankId = product.meta.bank;
    const bankRef = db.collection("_banks").doc(bankId);
    const bankSnapshot = await bankRef.get();

    if (!bankSnapshot.exists) {
      console.error(`Bank ${bankId} does not exist`);
    } else {
      const bank = bankSnapshot.data();
      axios.defaults.headers.common["x-v"] = bank.apiVersion;
      axios.defaults.headers.common["Accept"] = "application/json";
      const axiosConfig = bank.apiCertificateVerified ? {} : {httpsAgent: new https.Agent({rejectUnauthorized: false})};

      const response = await axios.get(
        `${bank.apiBaseUrl}/products/${product.productId}`, {...axiosConfig});

      await productSnapshot.ref.set({
        ...productDetails,
        meta: {
          ...product.meta,
          updated: new Date().toISOString(),
          hasDetail: true,
          type: parseCategoryType(productDetails.productCategory),
        },
      });
      syncSuccess = productDetails.productId;
    }
  } catch (error) {
    syncError = {
      message: `Error occurred while trying to update product details for ${product.productId} (${product.meta.bank})`,
      error,
    };
  }

  return [syncSuccess, syncError];
};
