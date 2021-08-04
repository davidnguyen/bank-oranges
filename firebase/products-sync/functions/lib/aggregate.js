/**
 * Runs aggregation for a collection in which from a source document there is only one target aggregation document
 * e.g. product.brand -> "CBA"
 * @param {FirebaseFirestore.Firestore} db Firestore database
 * @param {string} sourceCollection Source collection for aggregation
 * @param {(sourceDoc) => string} sourceDocIdSelector Selector for source document id
 * @param {string} targetCollection Target collection for aggregation results
 * @param {(sourceDoc) => string} targetDocIdSelector Selector function to return aggregate document id
 * @param {(aggregateDoc, sourceDoc) => any} aggregateFunction Function to aggregate new value from previous aggregate and current document
 * @param {(sourceDoc) => any} seedFunction Function to seed the initial aggregate value
 */
exports.aggregate = async (
  db,
  sourceCollection,
  sourceDocIdSelector,
  targetCollection,
  targetDocIdSelector,
  aggregateFunction,
  seedFunction,
) => {
  const sourceQuerySnapshot = await db.collection(sourceCollection).get();
  console.log(`Evaluating ${sourceQuerySnapshot.size} source entries`);

  let aggregatedDocs = 0;
  for (const sourceDocSnapshot of sourceQuerySnapshot.docs) {
    const sourceDocument = sourceDocSnapshot.data();

    if (!sourceDocument.meta.aggregated[targetCollection]) {
      const sourceDocId = sourceDocIdSelector(sourceDocument);
      const targetDocId = targetDocIdSelector(sourceDocument);
      const targetDocRef = db.collection(targetCollection).doc(targetDocId);
      const targetDocSnapshot = await targetDocRef.get();

      if (targetDocSnapshot.exists) {
        const targetDocument = targetDocSnapshot.data();

        // Only aggregate if sourceDocId not found in sources
        if (targetDocument.sources.indexOf(sourceDocId) < 0) {
          const aggregate = aggregateFunction(targetDocument, sourceDocument);
          await targetDocRef.set({
            ...targetDocument,
            ...aggregate,
            sources: [...targetDocument.sources, sourceDocId],
          });
        }
      } else {
        const seed = seedFunction(sourceDocument);
        await targetDocRef.set({
          ...seed,
          sources: [sourceDocId],
        });
      }

      await sourceDocSnapshot.ref.set({
        ...sourceDocument,
        meta: {
          ...sourceDocument.meta,
          aggregated: {...sourceDocument.meta.aggregated, [targetCollection]: true},
        },
      });

      aggregatedDocs += 1;
    }
  }

  console.log(`Aggregated ${aggregatedDocs} entries`);
};
