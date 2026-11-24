/* =============================================================================
   Trip To Venda · Firebase connection (LIVE)
   Project: trip-to-venda · database: Cloud Firestore, Johannesburg
   These values are not secret: every website that uses Firebase shows them.
   The security rules (firebase/firestore.rules) and App Check protect the data.
   ============================================================================= */
window.TTV_FIREBASE = {
  apiKey: 'AIzaSyC5zxnUk91YUzXeC8vmJObSTBgV__v9688',
  authDomain: 'trip-to-venda.firebaseapp.com',
  projectId: 'trip-to-venda',
  storageBucket: 'trip-to-venda.firebasestorage.app',
  messagingSenderId: '64811241567',
  appId: '1:64811241567:web:088bdbcae7e21a6ed60bea',

  // App Check (reCAPTCHA v3 site key): blocks requests that don't come from your website
  appCheckSiteKey: '',

  // Shown to drivers when they top up their wallet by EFT (bank, account name, account number, branch code)
  bank: '',

  // Set to true only once a payment provider (e.g. PayFast) is connected. Until then trips are cash only.
  onlinePayments: false
};
