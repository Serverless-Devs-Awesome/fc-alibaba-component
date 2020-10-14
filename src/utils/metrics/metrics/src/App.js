import React from 'react';
import Page from '@alicloud/console-components-page';
import Header from './components/Header'
import LineChart from './components/LineChart'

import { UserProvider } from './context'

export default () => {

  return (
    <UserProvider>
      <Page>
        <Page.Content>
          <Header />
          <LineChart />
        </Page.Content>
      </Page>
    </UserProvider>
  )
}
