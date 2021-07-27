const axios = require("axios");
const functions = require("firebase-functions");
const {parseCategoryType} = require("./utils");
const {getTotalPeriodicFee} = require("./utils");

/**
 * Sync propduct details
 * @param {FirebaseFirestore.Firestore} db Firestore database
 */
exports.syncProductDetails = async (db) => {
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

  await Promise.all(productQuerySnapshot.docs.map(async (productSnapshot) => {
    const product = productSnapshot.data();
    try {
      const bankId = product.meta.bank;
      const bankRef = db.collection("banks").doc(bankId);
      const bankSnapshot = await bankRef.get();

      if (!bankSnapshot.exists) {
        console.error(`Bank ${bankId} does not exist`);
      } else {
        const bank = bankSnapshot.data();
        axios.defaults.headers.common["x-v"] = bank.xv;
        axios.defaults.headers.common["Accept"] = "application/json";

        const response = await axios.get(
          `${bank.apiBaseUrl}/products/${product.productId}`);

        const productDetails = response.data.data;
        const [totalPeriodicFee, feeCalculationWarnings] =
          getTotalPeriodicFee(productDetails.fees);

        await productSnapshot.ref.set({
          ...productDetails,
          meta: {
            ...product.meta,
            updated: new Date().toISOString(),
            hasDetail: true,
            type: parseCategoryType(productDetails.productCategory),
            totalPeriodicFee,
            warnings: [...feeCalculationWarnings],
          },
        });
        syncSuccesses.push(productDetails.productId);
      }
    } catch (error) {
      syncErrors.push({
        message: `Error occurred while trying to update product details for ${product.productId} (${product.meta.bank})`,
        error,
      });
    }
  }));

  if (syncErrors.length > 0) {
    functions.logger.error("There were some errors while syncing product details", syncErrors);
  }

  functions.logger.info(`${syncSuccesses.length} of ${totalProductForSync} sync successfully, with ${syncErrors.length} errors.`);
};
