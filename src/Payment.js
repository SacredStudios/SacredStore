import React from 'react'
import './Payment.css'
import { useStateValue } from './StateProvider';
import CheckoutProduct from './CheckoutProduct';
import { Link, useNavigate } from 'react-router-dom';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useState, useEffect } from 'react';
import CurrencyFormat from 'react-currency-format';
import { getBasketTotal } from './reducer';
import axios from "./axios";

const Payment = () => {

  const [{basket, user}, dispatch] = useStateValue(); 
const navigate = useNavigate();
  
  const stripe = useStripe();
  const elements = useElements();

  const [succeeded, setSucceeded] = useState(false);
  const [processing, setProcessing] = useState("");

  const [error, setError] = useState(null);
  const [disabled, setDisabled] = useState(true);
  const [clientSecret, setClientSecret] = useState(true);

  useEffect(() => {
    //generate Stripe secret (required in order to make payments)

    const getClientSecret = async () => {
        const response = await axios ({
            method: 'post',
            url: `/payments/create?total=${getBasketTotal(basket)*100}` //Stripe uses cents as units for some reason
        });
        setClientSecret(response.data.clientSecret)
    }
    getClientSecret();
  }, [basket])

  const handleSubmit = async (event) => {
    event.preventDefault();
    setProcessing(true); //prevents accidental double-clicking
    const payload = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
            card: elements.getElement(CardElement),
        } //this is payment confirmation
    }).then(({ paymentIntent }) => {
        setSucceeded(true);
        setError(null);
        setProcessing(false);
        navigate('/orders', { replace: true });
    })
    //const payload = await stripe


  }
  const handleChange = event => {
    setDisabled(event.empty);
    setError(event.error ? event.error.message : "");
  }
  return (
    <div className='payment'>
      <div class="payment__container">

        <h1>
            Checkout {<Link to ='/checkout'>({basket?.length} items)</Link>}
        </h1>
        <div class="payment__section">
            <div class="payment__title">
                <h3>Delivery Address</h3>
            </div>
            <div class="payment__address">
                <p>{user?.email}</p>
                <p>Placeholder Street</p>
                <p>Placeholder State, Country</p>
            </div>

        </div>
        <div class="payment__section">
            <div class="payment__title">
                <h3>Review</h3>
            </div>
            <div class="payment__items">
                {basket.map(item => (
                    <CheckoutProduct
                        id={item.id}
                        title={item.title}
                        image={item.image}
                        price={item.price}                
                    />
                ))}
            </div>
        </div>
        <div class="payment__section">
            <div class="payment__title">
                <h3>Payment Method</h3>
            </div>
            <div class="payment__details">
                <form onSubmit={handleSubmit}>
                    <CardElement onChange={handleChange}/>
                    <div class="payment__priceContainer">
                        <CurrencyFormat
                         renderText={(value) => (
                            <>
                             <h3>
                                Order Total: {value}
                             </h3>
                            </>
                         )}
                         decimalScale={2}
                         value={getBasketTotal(basket)}
                         displayType={"text"}
                         thousandSeparator={true}
                         prefix={"$"}
                        />
                        <button disabled={processing || disabled || succeeded}>
                            <span>{ processing ? <p>Processing</p> :"Buy Now" }</span>
                        </button>
                    </div>
                    {error && <div>{error}</div>}
                </form>
            </div>
            
        </div>
      </div>
    </div>
  )
}

export default Payment
