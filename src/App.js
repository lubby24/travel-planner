import React from 'react';
import { Layout, Typography } from 'antd';
import TripPlanner from './components/TripPlanner';
import './App.css';

const { Header, Content } = Layout;
const { Title } = Typography;

function App() {
  return (
    <Layout className="layout">
      <Header style={{ 
        display: 'flex', 
        alignItems: 'center',
        background: 'transparent',
        position: 'relative',
        height: '80px',
        padding: '0 50px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        backgroundColor: '#fff'
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <Title 
            level={3} 
            style={{ 
              margin: 0,
              marginRight: '12px',
              fontWeight: 600,
              background: 'linear-gradient(45deg, #1890ff, #096dd9)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '1px'
            }}
          >
            伴旅
          </Title>
          <Title 
            level={5} 
            style={{ 
              margin: 0,
              fontWeight: 400,
              color: '#666',
              letterSpacing: '0.5px'
            }}
          >
            一路陪伴您的旅程
          </Title>
        </div>
      </Header>
      <Content style={{ padding: '50px' }}>
        <TripPlanner />
      </Content>
    </Layout>
  );
}

export default App; 