import React from 'react';
import CurrencyFormat from 'react-currency-format';
import "./Subtotal.css";
const Subtotal = () => {
  return (
    <div className ="subtotal">
      <CurrencyFormat
        renderText={(value) => (
            <>
                <p>
                    Subtotal ({basket.length} items):
                    <strong>{ ` ${value}`}</strong>
                </p>
            </>
        )}
        decimalScale={2}
        value={getBasketTotal(basket)}
        displayType={"text"}
        thousandSeparator={true}
        prefix={"$"}
        />
    </div>
  ) 
}

export default Subtotal
