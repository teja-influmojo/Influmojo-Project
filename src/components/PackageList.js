import React, { useState } from 'react';

const PackageList = ({ onPurchaseComplete }) => {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handlePurchase = async () => {
    setIsPurchasing(true);
    
    // Mock payment process
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setShowSuccess(true);
    setIsPurchasing(false);
    
    // After showing success message, trigger chat
    setTimeout(() => {
      onPurchaseComplete({
        userId: 'user2',
        nickname: 'Bob',
        isOnline: true
      });
    }, 2000);
  };

  return (
    <div className="package-list">
      <h3>Available Packages</h3>
      
      <div className="package-item">
        <div className="package-header">
          <h4>Premium Chat Package</h4>
          <span className="price">$9.99</span>
        </div>
        
        <div className="package-details">
          <p>Chat with Bob - Professional Consultant</p>
          <ul>
            <li>Unlimited chat access</li>
            <li>Priority response time</li>
            <li>Expert advice and guidance</li>
          </ul>
        </div>

        {!showSuccess ? (
          <button 
            className="purchase-btn"
            onClick={handlePurchase}
            disabled={isPurchasing}
          >
            {isPurchasing ? 'Processing...' : 'Purchase Now'}
          </button>
        ) : (
          <div className="success-message">
            <p>✅ Purchase Successful!</p>
            <p>Chat open</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PackageList; 