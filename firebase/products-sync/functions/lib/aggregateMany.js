/**
 * Runs aggregation for a collection in which from a source document there might be many target aggregation documents
 * e.g. product.eligibility -> ["BUSINESS", "RESIDENCY_STATUS", "OTHER"]
 * @param {FirebaseFirestore.Firestore} db Firestore database
 * @param {string} sourceCollection Source collection for aggregation
 * @param {(sourceDoc) => string} sourceDocIdSelector Selector for source document id
 * @param {(sourceDoc, targetDocId) => any} sourceDocElementSelector Selector for the element within the document to aggregate
 * @param {string} targetCollection Target collection for aggregation results
 * @param {(sourceDoc) => string[]} targetDocIdsSelector Selector function to return aggregate document ids
 * @param {(aggregateDoc, sourceDocument, sourceElement) => any} aggregateFunction Function to aggregate new value from previous aggregate and current document
 * @param {(sourceDocument, sourceElement) => any} seedFunction Function to seed the initial aggregate value
 */
exports.aggregateMany = async (
  db,
  sourceCollection,
  sourceDocIdSelector,
  sourceDocElementSelector,
  targetCollection,
  targetDocIdsSelector,
  aggregateFunction,
  seedFunction,
) => {
  const sourceQuerySnapshot = await db.collection(sourceCollection).get();
  console.log(`Evaluating ${sourceQuerySnapshot.size} source entries`);

  for (const sourceDocSnapshot of sourceQuerySnapshot.docs) {
    const sourceDocument = sourceDocSnapshot.data();
    const sourceDocId = sourceDocIdSelector(sourceDocument);
    const targetDocIds = targetDocIdsSelector(sourceDocument);

    for (const targetDocId of targetDocIds) {
      const targetDocRef = db.collection(targetCollection).doc(targetDocId);
      const targetDocSnapshot = await targetDocRef.get();
      const sourceElement = sourceDocElementSelector(sourceDocument, targetDocId);

      if (targetDocSnapshot.exists) {
        const targetDocument = targetDocSnapshot.data();

        // Only aggregate if sourceDocId not found in sources
        if (targetDocument.sources.indexOf(sourceDocId) < 0) {
          const aggregate = aggregateFunction(targetDocument, sourceDocument, sourceElement);
          await targetDocRef.set({
            ...targetDocument,
            ...aggregate,
            sources: [...targetDocument.sources, sourceDocId],
          });
        }
      } else {
        const seed = seedFunction(sourceDocument, sourceElement);
        await targetDocRef.set({
          ...seed,
          sources: [sourceDocId],
        });
      }
    }
  }
};
