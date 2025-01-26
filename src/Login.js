import React from 'react'
import "./Login.css"
import { Link } from 'react-router-dom'
import { useState } from 'react'
const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const signIn = e => {
        e.preventDefault();
        console.log("i am signing in");
    }

    const register = e => {
        e.preventDefault();

        
    }
    return (
        <div className="login">
            <Link to='/'>
        <img 
            className="login__logo"
            src="Logo.png"
        />
        </Link>

        <div class="login__container">
            <h1>Sign In</h1>
            <form>
                <h5>Email</h5>
                <input type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email" />

                <h5>Password</h5>
                <input type="password" value={password} onChange={e =>setPassword(e.target.value)} placeholder="Enter password" />
                <button className="login__signInButton" type="submit" onClick={signIn}>Sign In</button>

            </form>

            <button className="login__registerButton" onClick={register}>Create an account</button>
            

        </div>
        </div>
    )
    }

    export default Login
