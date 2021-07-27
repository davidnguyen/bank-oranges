/**
 * Runs aggregation for collection
 * @param {FirebaseFirestore.Firestore} db Firestore database
 * @param {string} sourceCollection Source collection for aggregation
 * @param {function} sourceDocIdSelector Selector for source document id
 * @param {string} targetCollection Target collection for aggregation results
 * @param {function} targetDocIdSelector Selector function to return aggregate document id
 * @param {function} aggregateFunction Function to aggregate new value from previous value
 * @param {function} aggregateSeed Function to seed the initial aggregate value
 */
exports.aggregate = async (
  db,
  sourceCollection,
  sourceDocIdSelector,
  targetCollection,
  targetDocIdSelector,
  aggregateFunction,
  aggregateSeed,
) => {
  const sourceQuerySnapshot = await db.collection(sourceCollection).get();
  console.log(`Aggregating ${sourceQuerySnapshot.size} source entries`);

  for (const sourceDocSnapshot of sourceQuerySnapshot.docs) {
    const sourceDocument = sourceDocSnapshot.data();
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
      const seed = aggregateSeed(sourceDocument);
      await targetDocRef.set({
        name: targetDocId,
        ...seed,
        sources: [sourceDocId],
      });
    }
  }
};
