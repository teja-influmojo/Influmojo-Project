// src/components/ReportModal.js
import React, { useState } from 'react';
import moderationService from '../services/moderationService';

// Create report modal utilities as an object pattern
const createReportModalUtils = () => {
  // Get report categories configuration
  const getReportCategories = () => {
    return [
      { value: moderationService.reportCategories.SPAM, label: 'Spam' },
      { value: moderationService.reportCategories.HARASSMENT, label: 'Harassment' },
      { value: moderationService.reportCategories.INAPPROPRIATE, label: 'Inappropriate Content' },
      { value: moderationService.reportCategories.SUSPICIOUS, label: 'Suspicious Activity' }
    ];
  };

  // Validate form data
  const validateForm = (selectedCategory) => {
    if (!selectedCategory) {
      alert('Please select a report category.');
      return false;
    }
    return true;
  };

  // Handle form submission
  const handleSubmit = async (e, formData, onSubmit, setIsSubmitting) => {
    e.preventDefault();
    
    if (!validateForm(formData.selectedCategory)) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSubmit(formData.selectedCategory, formData.description);
    } catch (error) {
      console.error('Failed to submit report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle backdrop click for modal closing
  const handleBackdropClick = (e, onClose) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle category selection
  const handleCategoryChange = (e, setSelectedCategory) => {
    setSelectedCategory(e.target.value);
  };

  // Handle description change
  const handleDescriptionChange = (e, setDescription) => {
    setDescription(e.target.value);
  };

  // Render modal header
  const renderModalHeader = (onClose) => {
    return (
      <div className="modal-header">
        <h3>Report Message</h3>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>
    );
  };

  // Render reported message preview
  const renderMessagePreview = (message) => {
    return (
      <div className="reported-message">
        <p><strong>Reporting message from:</strong> {message._sender.nickname}</p>
        <div className="message-preview">
          "{message.message}"
        </div>
      </div>
    );
  };

  // Render category selection field
  const renderCategoryField = (selectedCategory, handlers) => {
    const categories = getReportCategories();
    
    return (
      <div className="form-group">
        <label>Report Category *</label>
        <select
          value={selectedCategory}
          onChange={handlers.onCategoryChange}
          required
        >
          <option value="">Select a category</option>
          {categories.map(category => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // Render description field
  const renderDescriptionField = (description, handlers) => {
    return (
      <div className="form-group">
        <label>Additional Details (Optional)</label>
        <textarea
          value={description}
          onChange={handlers.onDescriptionChange}
          placeholder="Provide additional context about why you're reporting this message..."
          rows="4"
          maxLength="500"
        />
        <small>{description.length}/500 characters</small>
      </div>
    );
  };

  // Render modal actions (buttons)
  const renderModalActions = (isSubmitting, onClose) => {
    return (
      <div className="modal-actions">
        <button 
          type="button" 
          className="btn btn-secondary" 
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button 
          type="submit" 
          className="btn btn-danger"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Reporting...' : 'Submit Report'}
        </button>
      </div>
    );
  };

  // Render complete form
  const renderForm = (formData, handlers, isSubmitting, onClose) => {
    return (
      <form onSubmit={handlers.onSubmit}>
        {renderCategoryField(formData.selectedCategory, handlers)}
        {renderDescriptionField(formData.description, handlers)}
        {renderModalActions(isSubmitting, onClose)}
      </form>
    );
  };

  // Render modal body
  const renderModalBody = (message, formData, handlers, isSubmitting, onClose) => {
    return (
      <div className="modal-body">
        {renderMessagePreview(message)}
        {renderForm(formData, handlers, isSubmitting, onClose)}
      </div>
    );
  };

  return {
    getReportCategories,
    validateForm,
    handleSubmit,
    handleBackdropClick,
    handleCategoryChange,
    handleDescriptionChange,
    renderModalHeader,
    renderMessagePreview,
    renderCategoryField,
    renderDescriptionField,
    renderModalActions,
    renderForm,
    renderModalBody
  };
};

const ReportModal = ({ message, onSubmit, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create utils instance
  const utils = createReportModalUtils();

  // Create form data object
  const formData = {
    selectedCategory,
    description
  };

  // Create handlers object
  const handlers = {
    onSubmit: (e) => utils.handleSubmit(e, formData, onSubmit, setIsSubmitting),
    onCategoryChange: (e) => utils.handleCategoryChange(e, setSelectedCategory),
    onDescriptionChange: (e) => utils.handleDescriptionChange(e, setDescription),
    onBackdropClick: (e) => utils.handleBackdropClick(e, onClose)
  };

  return (
    <div className="modal-backdrop" onClick={handlers.onBackdropClick}>
      <div className="modal-content report-modal">
        {utils.renderModalHeader(onClose)}
        {utils.renderModalBody(message, formData, handlers, isSubmitting, onClose)}
      </div>
    </div>
  );
};

export default ReportModal;