import React from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import SearchIcon from '@mui/icons-material/Search';
import ChatIcon from '@mui/icons-material/Chat';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user, backendStatus } = useAuth();

  const features = [
    {
      icon: <PeopleIcon fontSize="large" />,
      title: 'Connect with Friends',
      description: 'Find and connect with friends from around the world.',
    },
    {
      icon: <SearchIcon fontSize="large" />,
      title: 'Search Users',
      description: 'Search for users by name, username, or email.',
    },
    {
      icon: <ChatIcon fontSize="large" />,
      title: 'Real-time Chat',
      description: 'Coming soon: Chat with your friends in real-time.',
    },
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          bgcolor: 'primary.main',
          color: 'white',
          py: 8,
          mb: 6,
          borderRadius: 2,
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h2" component="h1" gutterBottom align="center">
            Welcome to SocialSphere
          </Typography>
          <Typography variant="h5" align="center" paragraph>
            Connect with friends, share moments, and discover new communities.
          </Typography>
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
            {user ? (
              <>
                <Button
                  variant="contained"
                  color="secondary"
                  component={Link}
                  to="/profile"
                  size="large"
                >
                  Go to Profile
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  component={Link}
                  to="/search"
                  size="large"
                >
                  Search Users
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="contained"
                  color="secondary"
                  component={Link}
                  to="/register"
                  size="large"
                >
                  Get Started
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  component={Link}
                  to="/login"
                  size="large"
                >
                  Login
                </Button>
              </>
            )}
          </Box>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg">
        <Typography variant="h4" component="h2" gutterBottom align="center" sx={{ mb: 4 }}>
          Features
        </Typography>
        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item key={index} xs={12} md={4}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                  <Box sx={{ color: 'primary.main', mb: 2 }}>
                    {feature.icon}
                  </Box>
                  <Typography gutterBottom variant="h5" component="h3">
                    {feature.title}
                  </Typography>
                  <Typography color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                  <Button size="small" color="primary">
                    Learn More
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* System Status */}
        <Box sx={{ mt: 8, p: 3, bgcolor: 'grey.100', borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            System Status
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography>
                Frontend Server: <strong>✅ Running</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                URL: http://localhost:3000
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography>
                Backend Server: 
                <strong style={{ color: backendStatus.connected ? 'green' : 'red' }}>
                  {backendStatus.connected ? ' ✅ Connected' : ' ❌ Disconnected'}
                </strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                URL: http://localhost:5000
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
};

export default Home;
