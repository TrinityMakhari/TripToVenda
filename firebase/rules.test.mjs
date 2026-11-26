// Attack tests for firestore.rules. Every "DENY" line is something a hacker or a cheating user might try.
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';

const env = await initializeTestEnvironment({ projectId: 'demo-ttv', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
let pass = 0, fail = 0;
async function t(name, p, expect) {
  try { await (expect === 'ALLOW' ? assertSucceeds(p) : assertFails(p)); pass++; console.log('  ok   ', expect.padEnd(5), name); }
  catch (e) { fail++; console.log('  FAIL ', expect.padEnd(5), name, '\n        ', String(e.message || e).slice(0, 200)); }
}
const V = 'Venda (Limpopo)';
// --- seed with rules off ---
await env.withSecurityRulesDisabled(async c => {
  const d = c.firestore();
  await setDoc(doc(d, 'admins/boss'), { at: 1 });
  await setDoc(doc(d, 'profiles/drv'), { role: 'driver', name: 'Tshilidzi Mudau', status: 'verified', pro: false, vehicle: { type: 'seven', seats: 6, make: 'Innova' } });
  await setDoc(doc(d, 'private/drv'), { email: 'd@x.co', gender: 'Male', idNumber: '8604125800083' });
  await setDoc(doc(d, 'contacts/drv'), { name: 'Tshilidzi Mudau', phone: '0721234567', reg: 'HXK 482 L' });
  await setDoc(doc(d, 'profiles/rid'), { role: 'rider', name: 'Mulalo N.', status: 'verified', pro: false });
  await setDoc(doc(d, 'private/rid'), { email: 'r@x.co', gender: 'Female', idNumber: '0203150123088', homeAddress: 'Block G' });
  await setDoc(doc(d, 'contacts/rid'), { name: 'Mulalo Nemakonde', phone: '0790001111' });
  await setDoc(doc(d, 'docs/rid'), { idPhoto: 'data:...' });
  await setDoc(doc(d, 'faces/rid'), { selfie: 'data:...' });
  await setDoc(doc(d, 'profiles/eve'), { role: 'rider', name: 'Eve E.', status: 'pending', pro: false });
  await setDoc(doc(d, 'private/eve'), { email: 'e@x.co', gender: 'Female' });
  await setDoc(doc(d, 'profiles/drv2'), { role: 'driver', name: 'Other Driver', status: 'verified', pro: false, vehicle: { type: 'car', seats: 4 } });
  await setDoc(doc(d, 'trips/t1'), { driverId: 'drv', fromProv: V, toProv: 'Gauteng', status: 'open', seats: 6, price: 380, bagFee: 40, parcelPrice: 150, acceptsCash: true });
  await setDoc(doc(d, 'bookings/b1'), { tripId: 't1', riderId: 'rid', driverId: 'drv', type: 'seat', seats: 1, bigBags: 0, status: 'confirmed', fare: 380, riderFee: 15, total: 395, commission: 38, driverNet: 342, pay: 'online', payStatus: 'held' });
  await setDoc(doc(d, 'pins/b1'), { pin: '4817' });
});
const as = id => env.authenticatedContext(id, { email_verified: true }).firestore();
const asUnverified = id => env.authenticatedContext(id, { email_verified: false }).firestore();
const anon = env.unauthenticatedContext().firestore();
const R = as('rid'), D = as('drv'), E = as('eve'), A = as('boss'), D2 = as('drv2');
const okBooking = { tripId: 't1', riderId: 'rid', driverId: 'drv', type: 'seat', seats: 2, bigBags: 1, status: 'requested', fare: 800, riderFee: 30, total: 830, commission: 80, driverNet: 720, pay: 'cash', payStatus: 'due' };

console.log('\nPRIVATE DOCUMENTS');
await t('stranger reads rider ID photos', getDoc(doc(E, 'docs/rid')), 'DENY');
await t('driver reads rider ID photos', getDoc(doc(D, 'docs/rid')), 'DENY');
await t('not logged in reads private details', getDoc(doc(anon, 'private/rid')), 'DENY');
await t('stranger reads rider ID number/home address', getDoc(doc(E, 'private/rid')), 'DENY');
await t('anyone lists all private records', getDocs(collection(E, 'private')), 'DENY');
await t('rider reads own private details', getDoc(doc(R, 'private/rid')), 'ALLOW');
await t('Control room reads ID photos', getDoc(doc(A, 'docs/rid')), 'ALLOW');
await t('stranger reads rider phone (contacts)', getDoc(doc(E, 'contacts/rid')), 'DENY');
await t('driver reads rider phone WITHOUT a booking link', getDoc(doc(D, 'contacts/rid')), 'DENY');
await t('driver reads rider selfie WITHOUT a link', getDoc(doc(D, 'faces/rid')), 'DENY');
await t('rider grants her driver a 3-day link', setDoc(doc(R, 'links/drv_rid'), { until: Date.now() + 3 * 864e5 }), 'ALLOW');
await t('driver reads rider phone WITH link', getDoc(doc(D, 'contacts/rid')), 'ALLOW');
await t('driver reads rider selfie WITH link', getDoc(doc(D, 'faces/rid')), 'ALLOW');
await t('driver still cannot read rider ID photos', getDoc(doc(D, 'docs/rid')), 'DENY');
await t('Eve creates a link to spy on the rider', setDoc(doc(E, 'links/eve_rid'), { until: Date.now() + 864e5 }), 'DENY');
await t('rider grants a 1-year link', setDoc(doc(R, 'links/drv_rid'), { until: Date.now() + 365 * 864e5 }), 'DENY');
await t('public profile readable by visitors', getDoc(doc(anon, 'profiles/drv')), 'ALLOW');

console.log('\nACCOUNTS & APPROVAL');
await t('rider approves herself', updateDoc(doc(as('eve'), 'profiles/eve'), { status: 'verified' }), 'DENY');
await t('new user signs up already verified', setDoc(doc(as('neo'), 'profiles/neo'), { role: 'rider', name: 'Neo N.', status: 'verified', pro: false }), 'DENY');
await t('new user signs up as admin role', setDoc(doc(as('neo'), 'profiles/neo'), { role: 'admin', name: 'Neo N.', status: 'new', pro: false }), 'DENY');
await t('new user signs up normally', setDoc(doc(as('neo'), 'profiles/neo'), { role: 'rider', name: 'Neo N.', status: 'new', pro: false }), 'ALLOW');
await t('user sends self for review (pending)', updateDoc(doc(as('neo'), 'profiles/neo'), { status: 'pending' }), 'ALLOW');
await t('driver makes himself Pro (5% fee)', updateDoc(doc(D, 'profiles/drv'), { pro: true }), 'DENY');
await t('driver changes to a 14 seat minibus', updateDoc(doc(D, 'profiles/drv'), { vehicle: { type: 'seven', seats: 14 }, status: 'pending' }), 'DENY');
await t('user edits someone else\'s profile', updateDoc(doc(E, 'profiles/rid'), { name: 'Hacked' }), 'DENY');
await t('user makes himself Control room', setDoc(doc(E, 'admins/eve'), { at: 1 }), 'DENY');
await t('user lists the Control room accounts', getDocs(collection(E, 'admins')), 'DENY');
await t('Control room approves a rider', updateDoc(doc(A, 'profiles/eve'), { status: 'verified' }), 'ALLOW');
await t('verified rider swaps her ID photos', setDoc(doc(R, 'docs/rid'), { idPhoto: 'other' }), 'DENY');

console.log('\nTRIPS');
const trip = { driverId: 'drv', fromProv: V, toProv: 'Gauteng', status: 'open', seats: 4, price: 400, acceptsCash: true };
await t('verified driver posts a trip', setDoc(doc(D, 'trips/t2'), trip), 'ALLOW');
await t('driver with unverified email posts', setDoc(doc(asUnverified('drv'), 'trips/t3'), trip), 'DENY');
await t('rider posts a trip', setDoc(doc(R, 'trips/t4'), { ...trip, driverId: 'rid' }), 'DENY');
await t('driver posts as another driver', setDoc(doc(D2, 'trips/t5'), trip), 'DENY');
await t('driver sells 10 seats in a 7 seater', setDoc(doc(D, 'trips/t6'), { ...trip, seats: 10 }), 'DENY');
await t('trip not touching Venda', setDoc(doc(D, 'trips/t7'), { ...trip, fromProv: 'Gauteng', toProv: 'Western Cape' }), 'DENY');
await t('male driver posts women-only trip', setDoc(doc(D, 'trips/t8'), { ...trip, womenOnly: true }), 'DENY');
await t('driver edits own trip price', updateDoc(doc(D, 'trips/t1'), { price: 420 }), 'ALLOW');
await t('other driver edits the trip', updateDoc(doc(D2, 'trips/t1'), { price: 50 }), 'DENY');
await t('driver hands trip to another driver', updateDoc(doc(D, 'trips/t1'), { driverId: 'drv2' }), 'DENY');
await t('visitors can read trips', getDocs(collection(anon, 'trips')), 'ALLOW');
await env.withSecurityRulesDisabled(async c => setDoc(doc(c.firestore(), 'trips/t1'), { driverId: 'drv', fromProv: V, toProv: 'Gauteng', status: 'open', seats: 6, price: 380, bagFee: 40, parcelPrice: 150, acceptsCash: true }));

console.log('\nBOOKINGS & MONEY');
await t('rider books with correct price', setDoc(doc(R, 'bookings/b2'), okBooking), 'ALLOW');
await t('rider books paying R1 instead of R800', setDoc(doc(R, 'bookings/b3'), { ...okBooking, fare: 1, total: 31, commission: 0, driverNet: 1 }), 'DENY');
await t('rider skips the booking fee', setDoc(doc(R, 'bookings/b4'), { ...okBooking, riderFee: 0, total: 800 }), 'DENY');
await t('rider sets driver commission to 0', setDoc(doc(R, 'bookings/b5'), { ...okBooking, commission: 0, driverNet: 800 }), 'DENY');
await t('rider books as someone else', setDoc(doc(E, 'bookings/b6'), okBooking), 'DENY');
await t('rider books already confirmed', setDoc(doc(R, 'bookings/b7'), { ...okBooking, status: 'confirmed' }), 'DENY');
await t('rider sneaks the PIN into the booking', setDoc(doc(R, 'bookings/b8'), { ...okBooking, pin: '0000' }), 'DENY');
await t('driver books a seat', setDoc(doc(D, 'bookings/b9'), { ...okBooking, riderId: 'drv' }), 'DENY');
await t('rider saves PIN for own booking', setDoc(doc(R, 'pins/b2'), { pin: '2222' }), 'ALLOW');
await t('stranger reads a booking', getDoc(doc(E, 'bookings/b1')), 'DENY');
await t('stranger lists all bookings', getDocs(collection(E, 'bookings')), 'DENY');
await t('rider lists own bookings', getDocs(query(collection(R, 'bookings'), where('riderId', '==', 'rid'))), 'ALLOW');
await t('driver lists own trip bookings', getDocs(query(collection(D, 'bookings'), where('driverId', '==', 'drv'))), 'ALLOW');
await t('driver reads the rider\'s PIN', getDoc(doc(D, 'pins/b1')), 'DENY');
await t('rider reads own PIN', getDoc(doc(R, 'pins/b1')), 'ALLOW');
await t('rider marks own booking completed', updateDoc(doc(R, 'bookings/b1'), { status: 'completed' }), 'DENY');
await t('rider changes the price after booking', updateDoc(doc(R, 'bookings/b1'), { fare: 10 }), 'DENY');
await t('driver starts trip WITHOUT the PIN', updateDoc(doc(D, 'bookings/b1'), { status: 'picked' }), 'DENY');
await t('driver logs a wrong PIN try (1)', updateDoc(doc(D, 'bookings/b1'), { pinTry: '1111', pinTries: 1 }), 'ALLOW');
await t('driver starts with wrong PIN', updateDoc(doc(D, 'bookings/b1'), { status: 'picked' }), 'DENY');
await t('driver resets the try counter', updateDoc(doc(D, 'bookings/b1'), { pinTry: '1112', pinTries: 1 }), 'DENY');
await t('driver logs the right PIN (try 2)', updateDoc(doc(D, 'bookings/b1'), { pinTry: '4817', pinTries: 2 }), 'ALLOW');
await t('driver starts with the right PIN', updateDoc(doc(D, 'bookings/b1'), { status: 'picked' }), 'ALLOW');
await t('driver pays himself out', updateDoc(doc(D, 'bookings/b1'), { payout: 'paid' }), 'DENY');
await t('driver drops off', updateDoc(doc(D, 'bookings/b1'), { status: 'completed', payStatus: 'released', payout: 'pending', doneAt: Date.now() }), 'ALLOW');
await t('Control room marks payout paid', updateDoc(doc(A, 'bookings/b1'), { payout: 'paid' }), 'ALLOW');
// brute force
await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'bookings/bf'), { ...okBooking, status: 'confirmed' }); await setDoc(doc(c.firestore(), 'pins/bf'), { pin: '9999' }); });
for (let i = 1; i <= 5; i++) await updateDoc(doc(D, 'bookings/bf'), { pinTry: String(1000 + i), pinTries: i });
await t('6th PIN guess (brute force blocked)', updateDoc(doc(D, 'bookings/bf'), { pinTry: '9999', pinTries: 6 }), 'DENY');

console.log('\nREVIEWS, CHAT, ALERTS, WALLET');
await t('rider reviews her completed trip', setDoc(doc(R, 'reviews/b1_rid'), { bookingId: 'b1', from: 'rid', to: 'drv', stars: 5, text: 'Great' }), 'ALLOW');
await t('stranger writes a fake review', setDoc(doc(E, 'reviews/b1_eve'), { bookingId: 'b1', from: 'eve', to: 'drv', stars: 1, text: 'Bad' }), 'DENY');
await t('rider reviews twice (2nd doc)', setDoc(doc(R, 'reviews/x'), { bookingId: 'b1', from: 'rid', to: 'drv', stars: 5, text: 'Again' }), 'DENY');
await t('stranger posts into their chat', setDoc(doc(E, 'messages/m1'), { bookingId: 'b1', from: 'eve', participants: ['rid', 'drv'], text: 'hi' }), 'DENY');
await t('driver sends chat to rider', setDoc(doc(D, 'messages/m2'), { bookingId: 'b1', from: 'drv', participants: ['rid', 'drv'], text: 'On my way' }), 'ALLOW');
await t('stranger reads their chat', getDoc(doc(E, 'messages/m2')), 'DENY');
await t('driver adds R5000 to own wallet', setDoc(doc(D, 'ledger/l1'), { driverId: 'drv', amount: 5000 }), 'DENY');
await t('driver asks for a top up', setDoc(doc(D, 'topups/t1'), { driverId: 'drv', amount: 200, status: 'requested' }), 'ALLOW');
await t('driver marks own top up paid', updateDoc(doc(D, 'topups/t1'), { status: 'paid' }), 'DENY');
await t('family member raises a concern (no account)', setDoc(doc(anon, 'alerts/a1'), { kind: 'concern', userId: null, by: 'Mom', bookingId: 'b1' }), 'ALLOW');
await t('stranger reads SOS alerts', getDocs(collection(E, 'alerts')), 'DENY');
await t('random collection write', setDoc(doc(E, 'hack/x'), { a: 1 }), 'DENY');
await t('delete a trip', deleteDoc(doc(D, 'trips/t1')), 'DENY');

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
