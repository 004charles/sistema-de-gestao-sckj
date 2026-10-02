import React from 'react';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="footer-wrapper">
      <div className="container-fluid">
        <div className="row">
          <div className="col-md-6">
            <div className="footer-copyright">
              <p>{t('login.footer')}</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
