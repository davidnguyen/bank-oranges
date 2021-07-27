const axios = require("axios");
const functions = require("firebase-functions");

/**
 * Sync products for multiple banks at once
 * @param {FirebaseFirestore.Firestore} db Firestore database
 * @param {string[]} bankIds Array of bank identifiers
 * @param {number} pageSize Size of each product page to fetch from the bank
 */
exports.syncProductForMultipleBanks = async (db, bankIds, pageSize = 100) => {
  for (const bankId of bankIds) {
    await this.syncProductForBank(db, bankId, pageSize);
  }
};

/**
 * Sync products for a bank
 * @param {FirebaseFirestore.Firestore} db Firestore database
 * @param {string} bankId Bank identifier in the "banks" collection in firestore
 * @param {number} pageSize Size of each product page to request from the bank
 */
exports.syncProductForBank = async (db, bankId, pageSize = 100) => {
  // Retrieve bank record from firestore
  const bankRef = db.collection("banks").doc(bankId);
  const bankSnapshot = await bankRef.get();

  if (bankSnapshot.exists) {
    let page = 1;
    let totalPages = 1;
    let syncError = null;
    let totalProducts = 0;
    let totalProductAdded = 0;
    let totalProductUpdated = 0;
    const bank = bankSnapshot.data();

    // Set API version number configured in the bank record
    axios.defaults.headers.common["x-v"] = bank.xv;
    axios.defaults.headers.common["Accept"] = "application/json";

    try {
      // Iterate through every product pages
      while (page <= totalPages) {
        const response = await axios.get(
          `${bank.apiBaseUrl}/products?page=${page}&page-size=${pageSize}`);
        const products = response.data.data.products;

        totalPages = response.data.meta.totalPages;
        totalProducts = response.data.meta.totalRecords;

        functions.logger.log(
          `Processing products page ${page} out of ${totalPages} for ${bankId}`);

        if (products.length && products.length > 0) {
          await Promise.all(products.map(async (p) => {
            const productRef = db.collection("products")
              .doc(p.productId);
            const snapshot = await productRef.get();

            if (snapshot.exists) {
              const storedProduct = snapshot.data();

              if (p.lastUpdated !== storedProduct.lastUpdated) {
                await productRef.set({
                  ...storedProduct,
                  meta: {
                    ...storedProduct.meta,
                    hasDetail: false,
                  },
                });
                totalProductUpdated++;
              }
            } else {
              await productRef.set({
                ...p,
                meta: {
                  bank: bankId,
                  created: new Date().toISOString(),
                  updated: new Date().toISOString(),
                  hasDetail: false,
                },
              });
              totalProductAdded++;
            }
          }));
        } else {
          console.error(`No available products in this sync for ${bankId}`);
        }
        page = page + 1;
      }
    } catch (error) {
      functions.logger.error(`There was an error while trying to sync products for ${bankId}`,
        error);
      syncError = error.response ? error.response.data : error;
    }

    await bankRef.set({
      ...bank,
      syncProductResult: {
        lastSyncedAt: new Date().toISOString(),
        status: syncError ? "error" :
          `Success with ${totalProducts} products found, ${totalProductAdded} added, ${totalProductUpdated} updated`,
        error: syncError,
      },
    });
  } else {
    console.error(`Bank ${bankId} does not exist`);
  }
};
