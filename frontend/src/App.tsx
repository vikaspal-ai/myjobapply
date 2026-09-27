import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/layout/Navbar.js';
import { Footer } from './components/layout/Footer.js';
import { LandingView } from './components/landing/LandingView.js';
import { WorkspaceView } from './components/workspace/WorkspaceView.js';
import { AuthModal } from './components/auth/AuthModal.js';
import { OperatorConsoleModal } from './components/console/OperatorConsoleModal.js';

export type StepKey = 'profile' | 'jobs' | 'resume' | 'apply' | 'referrals';

const MainContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<StepKey>('profile');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar 
        onOpenConsole={() => setIsConsoleOpen(true)} 
        activeStep={activeStep}
        setActiveStep={setActiveStep}
      />
      
      <main style={{ flex: 1 }}>
        {isAuthenticated ? (
          <WorkspaceView activeStep={activeStep} setActiveStep={setActiveStep} />
        ) : (
          <LandingView />
        )}
      </main>

      <Footer />
      <AuthModal />
      <OperatorConsoleModal isOpen={isConsoleOpen} onClose={() => setIsConsoleOpen(false)} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
};

export default App;
