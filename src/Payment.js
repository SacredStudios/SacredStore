import React from 'react'
import './Payment.css'
import { useStateValue } from './StateProvider';
import CheckoutProduct from './CheckoutProduct';
import { Link } from 'react-router-dom';

const Payment = () => {

  const [{basket, user}, dispatch] = useStateValue();  
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
                {/*Stripe Payments*/}
            </div>
            
        </div>
      </div>
    </div>
  )
}

export default Payment
