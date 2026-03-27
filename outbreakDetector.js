/**
 * outbreakDetector.js
 * Firebase Cloud Function for outbreak detection.
 * 
 * Trigger: Firestore detects 3+ patients in same village with same symptoms within 72 hrs
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

exports.detectOutbreak = functions.firestore
    .document('patients/{patientId}')
    .onCreate(async (snap, context) => {
        const newPatient = snap.data();
        const { villageName, symptomType, timestamp, location } = newPatient;

        // Define 72-hour window
        const seventyTwoHoursAgo = admin.firestore.Timestamp.fromDate(
            new Date(Date.now() - 72 * 60 * 60 * 1000)
        );

        // Query for similar cases in the same village within 72 hours
        const querySnapshot = await db.collection('patients')
            .where('villageName', '==', villageName)
            .where('symptomType', '==', symptomType)
            .where('timestamp', '>=', seventyTwoHoursAgo)
            .get();

        const caseCount = querySnapshot.size;

        if (caseCount >= 3) {
            console.log(`Outbreak detected in ${villageName} for ${symptomType}. Case count: ${caseCount}`);

            // Create or update outbreak record
            const outbreakRef = db.collection('outbreaks').doc(`${villageName}_${symptomType}`);
            
            await outbreakRef.set({
                villageName,
                symptomType,
                caseCount,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                location,
                status: 'active'
            }, { merge: true });

            // Optional: Send FCM notification to DHO
            // const payload = {
            //     notification: {
            //         title: 'Outbreak Alert!',
            //         body: `3+ cases of ${symptomType} detected in ${villageName}.`
            //     }
            // };
            // await admin.messaging().sendToTopic('dho_alerts', payload);
        }

        return null;
    });
