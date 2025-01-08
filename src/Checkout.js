import React from 'react'
import "./Checkout.css";
import Subtotal from "./Subtotal";
const Checkout = () => {
  return (
    <div className="checkout">
        <div class="checkout__left">
            <a href="https://sacredstudios.itch.io/rolleroidz19" target="_blank" rel="noopener noreferrer">
                <img className="checkout__ad" src="/rolleroidzbanner.jpg" alt="Checkout Banner"/>
            </a>

            <div>
                <h2 class="checkout__title">
                    Your Shopping Basket
                </h2>
            </div>
        </div>
        <div class="checkout__right">
            <Subtotal />
        </div>
    </div>
  )
}

export default Checkout
