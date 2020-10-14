import React from 'react';
import { render } from 'react-dom';
import App from './App';

import './index.css';
import '@alicloud/console-components/dist/wind.css';

render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

