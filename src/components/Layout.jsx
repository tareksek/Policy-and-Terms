import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { Container, Box, Alert } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const { backendStatus } = useAuth();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <Navbar />
      
      {!backendStatus.connected && (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          ⚠️ Cannot connect to backend server. Some features may not work.
        </Alert>
      )}
      
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
      
      <Box component="footer" sx={{ py: 3, mt: 'auto', bgcolor: 'grey.900', color: 'white' }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <strong>Social Media Platform</strong>
              <Box sx={{ fontSize: '0.875rem', color: 'grey.400', mt: 1 }}>
                © {new Date().getFullYear()} - MVP Version 1.0
              </Box>
            </Box>
            <Box sx={{ fontSize: '0.875rem', color: 'grey.400' }}>
              Backend: {backendStatus.connected ? '✅ Connected' : '❌ Disconnected'}
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Layout;
