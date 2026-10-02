import React from 'react';
import { useTranslation } from 'react-i18next';

const ConfirmModal = ({
  show,
  onClose,
  onConfirm,
  title,
  subtitle,
  confirmLabel,
  confirmClass = 'btn-primary',
  children,
}) => {
  const { t } = useTranslation();
  if (!show) return null;

  return (
    <>
      <div
        className="modal fade show"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        style={{ display: 'block' }}
        onClick={onClose}
      >
        <div className="modal-dialog modal-md" role="document" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header" style={{ backgroundColor: '#5f63f2' }}>
              <div>
                <h6 className="modal-title" style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>
                  {title}
                </h6>
                {subtitle && (
                  <span className="d-block" style={{ fontSize: 12.5, color: '#fff', opacity: 0.9 }}>
                    {subtitle}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="close"
                aria-label={t('common.close')}
                onClick={onClose}
                style={{ color: '#fff' }}
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>

            <div className="modal-body p-25">{children}</div>

            <div
              className="modal-footer d-flex justify-content-end"
              style={{ borderTop: '1px solid #f1f2f6', padding: '15px 25px', gap: 10 }}
            >
              <button type="button" className="btn btn-default btn-squared" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button type="button" className={`btn btn-squared ${confirmClass}`} onClick={onConfirm}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
};

export default ConfirmModal;
