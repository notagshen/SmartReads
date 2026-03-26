import React, { useEffect, useState } from 'react';
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import ContentPanel from './components/ContentPanel/ContentPanel';
import StatusBar from './components/StatusBar/StatusBar';
import SettingsModal from './components/SettingsModal/SettingsModal';
import { useAppContext } from './contexts/AppContext';
import styles from './App.module.css';

const hasShareRoute = () => {
  try {
    const searchParams = new URLSearchParams(window.location.search || '');
    const remoteId = searchParams.get('share');
    const hash = window.location.hash || '';
    return Boolean((remoteId && remoteId.trim()) || hash.startsWith('#share='));
  } catch (error) {
    return false;
  }
};

const shouldAnimateInitialShare = () => {
  try {
    if (!hasShareRoute()) return false;
    const navigation = performance.getEntriesByType('navigation')?.[0];
    if (navigation?.type === 'reload') return false;
    if (!document.referrer) return false;
    return new URL(document.referrer).origin === window.location.origin;
  } catch (error) {
    return false;
  }
};

function App() {
  const { theme } = useAppContext();
  const [isLoaded, setIsLoaded] = useState(false);
  const initialShareAnimation = shouldAnimateInitialShare();
  const initialShareMode = hasShareRoute();
  const [isShareMode, setIsShareMode] = useState(initialShareAnimation ? false : initialShareMode);
  const [enableShareAnimation, setEnableShareAnimation] = useState(initialShareAnimation);

  useEffect(() => {
    // 模拟页面加载完成
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!initialShareAnimation || !initialShareMode) {
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      setEnableShareAnimation(true);
      setIsShareMode(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialShareAnimation, initialShareMode]);

  useEffect(() => {
    const handleLocationChange = () => {
      const nextShareMode = hasShareRoute();
      setIsShareMode((prev) => {
        if (!prev && nextShareMode) {
          setEnableShareAnimation(true);
        } else if (prev && !nextShareMode) {
          setEnableShareAnimation(false);
        }
        return nextShareMode;
      });
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  return (
    <div 
      className={`${styles.appContainer} ${isLoaded ? 'animate-page-load' : ''}`} 
      data-theme={theme}
    >
      <Header />
      <main
        className={[
          styles.mainContainer,
          isShareMode ? styles.shareMode : '',
          enableShareAnimation ? styles.shareAnimate : styles.shareNoAnimate
        ].filter(Boolean).join(' ')}
      >
        <div className={styles.sidebarSlot}>
          <Sidebar />
        </div>
        <div className={styles.contentSlot}>
          <ContentPanel />
        </div>
      </main>
      <StatusBar />
      <SettingsModal />
    </div>
  );
}

export default App; 
