import React, { useEffect, useRef, useState } from 'react';
import { FaLock, FaTimes } from 'react-icons/fa';
import Button from '../common/Button/Button';
import styles from './SettingsModal.module.css';
import { verifySettingsPassword } from '../../utils/settingsAccess';

const SettingsPasswordModal = ({ isOpen, onClose, onVerified }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setPassword('');
      setError('');
      return;
    }

    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();

    if (verifySettingsPassword(password)) {
      setPassword('');
      setError('');
      onVerified();
      return;
    }

    setError('密码不正确，请重试');
  };

  return (
    <div className={`${styles.modalOverlay} ${styles.active}`} onClick={onClose}>
      <form className={`${styles.modalContainer} ${styles.passwordContainer}`} onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3><FaLock /> 验证密码</h3>
          <button type="button" onClick={onClose} className={styles.modalClose} aria-label="关闭验证">
            <FaTimes />
          </button>
        </div>

        <div className={styles.passwordContent}>
          <label className={styles.passwordLabel} htmlFor="settingsPassword">设置密码</label>
          <input
            id="settingsPassword"
            ref={inputRef}
            type="password"
            className={styles.passwordInput}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError('');
            }}
            autoComplete="current-password"
          />
          {error && <div className={styles.passwordError} role="alert">{error}</div>}
        </div>

        <div className={styles.modalFooter}>
          <Button label="取消" onClick={onClose} variant="secondary" />
          <Button type="submit" label="验证" icon={<FaLock />} />
        </div>
      </form>
    </div>
  );
};

export default SettingsPasswordModal;
