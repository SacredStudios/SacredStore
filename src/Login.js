import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import "./Login.css";

import { auth } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
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

  // 4. Forgot Password Feature
  const forgotPassword = (e) => {
    e.preventDefault();
    if (!email) {
      alert("Please enter your email address in the email field first.");
      return;
    }
    sendPasswordResetEmail(auth, email)
      .then(() => {
        alert("Password reset email sent! Please check your inbox/spam folder.");
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
          src="/logo.png"
          alt="Logo"
        />
      </Link>

      <div className="login__container">
        {/* Forgot password clickable text */}
        <span 
          className="login__forgotPassword" 
          onClick={forgotPassword}
        >
          Forgot my password?
        </span>

        <h1>Sign In</h1>
        <form>
          <h5>Email</h5>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email..."
          />

          <h5>Password</h5>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password..."
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

        {/* Google Sign-In Button */}
        <button className="login__registerButton" onClick={signInWithGoogle}>
          Sign in with{" "}
          <span className="googleLogoText">
            <span style={{ color: "#4285F4" }}>G</span>
            <span style={{ color: "#DB4437" }}>o</span>
            <span style={{ color: "#F4B400" }}>o</span>
            <span style={{ color: "#4285F4" }}>g</span>
            <span style={{ color: "#0F9D58" }}>l</span>
            <span style={{ color: "#DB4437" }}>e</span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default Login;
