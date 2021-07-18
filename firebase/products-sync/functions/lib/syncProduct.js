const axios = require("axios");
const functions = require("firebase-functions");

/**
 * Sync prpducts for a bank
 * @param {FirebaseFirestore.Firestore} db Firestore database
 * @param {string} bankId Bank identifier in the "banks" collection in firestore
 */
exports.syncProductForBank = async (db, bankId) => {
  try {
    // Retrieve bank record from firestore
    const bankRef = db.collection("banks").doc(bankId);
    const bankSnapshot = await bankRef.get();

    if (bankSnapshot.exists) {
      let page = 1;
      let totalPages = 1;
      const bank = bankSnapshot.data();

      // Set API version number configured in the bank record
      axios.defaults.headers.common["x-v"] = bank.xv;
      axios.defaults.headers.common["Accept"] = "application/json";

      // Iterate through every product pages
      while (page <= totalPages) {
        const response = await axios.get(
          `${bank.apiBaseUrl}/products?page=${page}`);
        const products = response.data.data.products;

        totalPages = response.data.meta.totalPages;

        functions.logger.log(
          `Processing products page ${page} out of ${totalPages}`);

        if (products.length && products.length > 0) {
          await Promise.all(products.map(async (p) => {
            const productRef = db.collection("products")
              .doc(p.productId);
            const snapshot = await productRef.get();

            if (snapshot.exists) {
              const storedProduct = snapshot.data();

              if (p.lastUpdated !== storedProduct.lastUpdated) {
                await productRef.set(p);
                console.log(`Product '${p.name}' (${p.productId}) is updated`);
              } else {
                console.log(`Product '${p.name}' (${p.productId}) is skipped,
                  no changes since last update`);
              }
            } else {
              await productRef.set(p);
              console.log(`Product '${p.name}' (${p.productId}) is added`);
            }
          }));
        } else {
          console.error("No available products in this sync");
        }

        page = page + 1;
      }
    } else {
      console.error(`Bank ${bankId} does not exist`);
    }
  } catch (error) {
    functions.logger.error("There was an error while trying to sync products",
      error);
    functions.logger.error("error.response.data", error.response.data);
  }
};
