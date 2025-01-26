import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import "./Login.css";

import { auth } from './firebase'; // Import the configured auth instance
import { createUserWithEmailAndPassword } from "firebase/auth";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const signIn = (e) => {
        e.preventDefault();
        // Add sign-in logic here later
        console.log("Sign-in functionality to be implemented.");
    };

    const register = (e) => {
        e.preventDefault();
        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Successfully created a user
                console.log("User registered:", userCredential.user);
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
            </div>
        </div>
    );
};

export default Login;
