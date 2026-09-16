// firebase-config.js
// Fill these in from: Firebase Console → Project Settings → General →
// "Your apps" → SDK setup and configuration → Config.
// These values are safe to expose in client-side code — they identify your
// project, they are not secrets. Access control is enforced by Firebase
// Auth + Firestore security rules, not by hiding this file.

<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyDN7wHbJmDUFjAPMO8HlnQ1VX7J5ki9zo8",
    authDomain: "metastable-design-website.firebaseapp.com",
    projectId: "metastable-design-website",
    storageBucket: "metastable-design-website.firebasestorage.app",
    messagingSenderId: "698169227126",
    appId: "1:698169227126:web:b52854d3f0562c77f36c57",
    measurementId: "G-7E720JYCC4"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>
