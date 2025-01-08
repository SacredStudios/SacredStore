import React, { useState, useEffect } from 'react';
import './Header.css';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket';
import { Link } from 'react-router-dom';
import { useStateValue } from "./StateProvider";

const Header = () => {
  const [{ basket, dispatch }] = useStateValue();

  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    setBounce(true);
    const timer = setTimeout(() => {
      setBounce(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [basket]);

  return (
    <div className="header">
      <Link to="/">
        <img 
          className="header__logo"
          src="/logo.png"
          alt="Logo"
        />
      </Link>      
      
      <div className="header__search">
        <input
          className="header__searchInput"
          type="text"
        />
        <SearchIcon className="header__searchIcon"/>
      </div>

      <div className="header__nav">
        <div className="header__option">
          <span className="header__optionLineOne">Hello Guest</span>
          <span className="header__optionLineTwo">Sign in</span>
        </div>
        <div className="header__option">
          <span className="header__optionLineOne">Returns</span>
          <span className="header__optionLineTwo">& Orders</span>
        </div>
        
        <Link to="/checkout">
          {/* Conditionally add the bounce class */}
          <div className={`header__optionBasket ${bounce ? 'bounce' : ''}`}>
            <ShoppingBasketIcon />
            <span className="header__optionLineTwo header__basketCount">
              {basket?.length}
            </span>   
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Header;
