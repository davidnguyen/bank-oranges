/**
 * Runs aggregation for collection
 * @param {FirebaseFirestore.Firestore} db Firestore database
 * @param {string} consumerName Name of the aggregator
 * @param {string} sourceCollection The source collection for aggregation
 * @param {string} targetCollection The target collection for
 * aggregation results
 * @param {function} aggregateDocIdSelector Selector function to
 * return aggregate document id
 * @param {function} aggregateFunction Function to aggregate new value
 * from previous value
 * @param {function} aggregateSeed Function to seed the initial aggregate value
 */
exports.aggregate = async (
  db,
  consumerName,
  sourceCollection,
  targetCollection,
  aggregateDocIdSelector,
  aggregateFunction,
  aggregateSeed,
) => {
  const sourceQuerySnapshot = await db.collection(sourceCollection)
    .where(`meta.aggregators.${consumerName}`, "==", 0)
    .get();
  console.log(`Aggregating ${sourceQuerySnapshot.size} source entries`);

  for (const sourceDocSnapshot of sourceQuerySnapshot.docs) {
    const sourceDocument = sourceDocSnapshot.data();
    const targetDocId = aggregateDocIdSelector(sourceDocument);
    const targetDocRef = db.collection(targetCollection).doc(targetDocId);
    const targetDocSnapshot = await targetDocRef.get();

    if (targetDocSnapshot.exists) {
      const targetDocument = targetDocSnapshot.data();
      await targetDocRef.set(aggregateFunction(targetDocument,
        sourceDocument));
    } else {
      await targetDocRef.set(aggregateSeed(sourceDocument));
    }
    await sourceDocSnapshot.ref.set({
      ...sourceDocument,
      meta: {
        ...sourceDocument.meta,
        aggregators: {...sourceDocument.meta.aggregators, [consumerName]: 1},
      },
    });
  }
};
