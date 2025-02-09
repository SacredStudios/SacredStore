import React from 'react'
import "./CheckoutProduct.css"
import { useStateValue } from './StateProvider';

const CheckoutProduct = ({id, image, title, price, rating, hideButton}) => {

    
    const [{basket}, dispatch] = useStateValue();
    const removeFromBasket = () => {
            dispatch({
                type: 'REMOVE_FROM_BASKET',
                id: id,
            })
    }
  return (
    <div className="checkoutProduct">
      <img  className="checkoutProduct__image" src={image} />
      <div class="checkoutProduct__info">
        <p className="checkoutProduct__title">{title}</p>
        <p className="checkoutProduct__price">
            <small>$</small>
            <strong>{price}</strong>
        </p>
        { !hideButton && (
        <button onClick={removeFromBasket}>Remove</button>
        )
        }
      </div>
    </div>
  )
}

export default CheckoutProduct
