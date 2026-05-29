import React from "react";

export default function WalletBox({ coins, recharge }) {
  return (
    <div className="wallet">
      <div>
        <h3>Your Wallet</h3>
        <p>{coins} Coins Available</p>
      </div>

      <button onClick={recharge}>
        Recharge +100
      </button>
    </div>
  );
}