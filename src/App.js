import React from 'react';
import { Layout } from 'antd';
import TripPlanner from './components/TripPlanner';
import './App.css';

const { Header, Content } = Layout;

function App() {
  return (
    <Layout className="layout">
      <Header>
        <h1 style={{ color: 'white' }}>旅游行程规划</h1>
      </Header>
      <Content style={{ padding: '50px' }}>
        <TripPlanner />
      </Content>
    </Layout>
  );
}

export default App; 