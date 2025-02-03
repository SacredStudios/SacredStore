import React from 'react';
import CurrencyFormat from 'react-currency-format';
import "./Subtotal.css";
import { useStateValue } from "./StateProvider";
import { getBasketTotal } from "./reducer";
import { useNavigate } from 'react-router-dom';
const Subtotal = () => {
  const navigate = useNavigate();
  const [{ basket }, dispatch] = useStateValue();
  return (
    <div className ="subtotal">
      <CurrencyFormat
        renderText={(value) => (
            <>
                <p>
                    Subtotal ({basket.length} items)
                    <strong> {value}</strong>
                </p>
            </>
        )}
        decimalScale={2}
        value={getBasketTotal(basket)}
        displayType={"text"}
        thousandSeparator={true}
        prefix={"$"}
        />
        {
        basket.length > 0 && 
        <button onClick={e =>navigate('/payment')}>Proceed to Checkout</button>
        }
    </div>
  ) 
}

export default Subtotal
