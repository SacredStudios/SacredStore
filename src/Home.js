import React from 'react'
import "./Home.css"
import Product from "./Product"

const Home = () => {
  return (
    <div class="home">
        <div class="home__container">
            <img 
            className="home__image"
            src ="/banner.png"
            alt=""></img>
            <div className="home__row">
                <Product 
                id="100"
                title="Custom N64 Era Mario Action Figure (Super Mario 64)"
                image="/placeholder_product.jpg"
                price={75}
                />
                <Product />
            </div>
            <div className="home__row">
                <Product />
                <Product />
            </div>
        </div>
    </div>
  )
}

export default Home
