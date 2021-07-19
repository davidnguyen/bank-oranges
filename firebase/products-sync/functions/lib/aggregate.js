/**
 * Runs aggregation for collection
 * @param {FirebaseFirestore.Firestore} db Firestore database
 * @param {string} consumerName Name of the aggregator
 * @param {string} eventType Type of event to aggregate
 * @param {string} aggregateCollection Collection to aggregate
 * @param {function} aggregateDocIdSelector Selector function to
 * return aggregate document id
 * @param {function} aggregateFunction Function to aggregate new value
 * from previous value
 * @param {function} aggregateSeed Function to seed the initial aggregate value
 */
exports.aggregate = async (
  db,
  consumerName,
  eventType,
  aggregateCollection,
  aggregateDocIdSelector,
  aggregateFunction,
  aggregateSeed,
) => {
  const syncEventQuerySnapshot = await db.collection("syncEvents")
    .where("type", "==", eventType)
    .get();
  console.log(`Aggregating ${syncEventQuerySnapshot.size} events`);

  for (const syncEventDocSnapshot of syncEventQuerySnapshot.docs) {
    const syncEvent = syncEventDocSnapshot.data();

    // Only aggregate on event that has not been aggregated before
    // by the same aggregator (consumer)
    if (syncEvent.consumers.indexOf(consumerName) < 0) {
      const aggregateDocId = aggregateDocIdSelector(syncEvent.document);
      const aggregateDocRef = db.collection(aggregateCollection)
        .doc(aggregateDocId);
      const aggregateDocSnapshot = await aggregateDocRef.get();

      if (aggregateDocSnapshot.exists) {
        const aggregateDoc = aggregateDocSnapshot.data();
        await aggregateDocRef.set(aggregateFunction(aggregateDoc,
          syncEvent.document));
      } else {
        await aggregateDocRef.set(aggregateSeed(syncEvent.document));
      }

      await syncEventDocSnapshot.ref.set({
        ...syncEvent,
        consumers: [...syncEvent.consumers, consumerName],
      });
    }
  }
};
