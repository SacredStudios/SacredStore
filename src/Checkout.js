import React from 'react'
import "./Checkout.css";
import Subtotal from "./Subtotal";
import CheckoutProduct from "./CheckoutProduct";
import { useStateValue } from './StateProvider';
const Checkout = () => {
  const [{ basket, dispatch }] = useStateValue();
  return (
    <div className="checkout">
        <div class="checkout__left">
            <a href="https://sacredstudios.itch.io/rolleroidz19" target="_blank" rel="noopener noreferrer">
                <img className="checkout__ad" src="/rolleroidzbanner.jpg" alt="Checkout Banner"/>
            </a>

            <div>
                <h2 class="checkout__title">
                    Your Shopping Cart
                </h2>
                {basket.map(item =>(
                    <CheckoutProduct
                        id= {item.id}
                        image = {item.image}
                        title = {item.title}
                        price = {item.price}
                        rating = {item.rating}

                    />
                ))}

            </div>
        </div>
        <div class="checkout__right">
            <Subtotal />
        </div>
    </div>
  )
}

export default Checkout
