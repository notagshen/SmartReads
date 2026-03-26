import React, { useEffect, useState } from 'react';
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import ContentPanel from './components/ContentPanel/ContentPanel';
import StatusBar from './components/StatusBar/StatusBar';
import SettingsModal from './components/SettingsModal/SettingsModal';
import { useAppContext } from './contexts/AppContext';
import styles from './App.module.css';

function App() {
  const { theme } = useAppContext();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // 模拟页面加载完成
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      className={`${styles.appContainer} ${isLoaded ? 'animate-page-load' : ''}`} 
      data-theme={theme}
    >
      <Header />
      <main className={styles.mainContainer}>
        <Sidebar />
        <ContentPanel />
      </main>
      <StatusBar />
      <SettingsModal />
    </div>
  );
}

export default App; 