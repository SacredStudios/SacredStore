import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import "./Login.css";

import { auth } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 1. Sign In with Email & Password
  const signIn = (e) => {
    e.preventDefault();

    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Check if the user's email is verified
        if (userCredential.user.emailVerified) {
          console.log("Signed in successfully:", userCredential.user);
          navigate("/");
        } else {
          alert("Please verify your email address before logging in.");
        }
      })
      .catch((error) => {
        alert(error.message);
      });
  };

  // 2. Create an Account with Email Verification
  const register = (e) => {
    e.preventDefault();

    createUserWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
        const user = userCredential.user;
        console.log("User registered:", user);

        try {
          await sendEmailVerification(user);
          alert("Verification email sent! Please check your inbox/spam folder.");

          // Optionally, you could log the user out immediately after registration
          // so they can't navigate while unverified:
          // auth.signOut();

          // If you prefer to navigate them somewhere else:
          // navigate("/verify-instructions");
        } catch (verificationError) {
          alert("Failed to send verification email:", verificationError.message);
        }
      })
      .catch((error) => {
        alert(error.message);
      });
  };

  // 3. Sign In with Google
  const signInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then((result) => {
        // Google accounts are typically already verified,
        // but you can check if needed:
        if (result.user.emailVerified) {
          console.log("Google Sign-In successful:", result.user);
          navigate("/");
        } else {
          alert("Email is not verified. Please verify your email.");
        }
      })
      .catch((error) => {
        alert(error.message);
      });
  };

  return (
    <div className="login">
      <Link to='/'>
        <img
          className="login__logo"
          src="Logo.png"
          alt="Logo"
        />
      </Link>

      <div className="login__container">
        <h1>Sign In</h1>
        <form>
          <h5>Email</h5>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email"
          />

          <h5>Password</h5>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
          />

          <button
            className="login__signInButton"
            type="submit"
            onClick={signIn}
          >
            Sign In
          </button>
        </form>

        <button
          className="login__registerButton"
          onClick={register}
        >
          Create an account
        </button>

        {/* 4. Google Sign-In Button */}
        <button
          className="login__googleButton"
          onClick={signInWithGoogle}
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default Login;
