import React from 'react'
import "./Product.css"
const Product = ({title, image, price, rating}) => {
  return (
    <div className="product">
      <div className = "product__info">
        {title}
            <p className="product__price">
                <small>$</small>
                <strong>{price}</strong>
            </p>
        <div class="product__rating">
            {Array(rating).fill().map((_, i) => (
                <p>⭐</p>
            ))}
            
        </div>
        </div>
        <img src={image}
        alt="/placeholder_product.jpg"/>
        <button>Add to Cart</button>
    </div>
  )
}

export default Product
