import React, { useEffect, useState } from 'react';
import { Chart, Legend, Axis, Geom } from 'bizcharts';
import { Loading } from '@alicloud/console-components';

import { FORMAT } from '../../../constants'
const moment = require('moment');

export default ({ data, titleNode, loading }) => {
  const [dv, setData] = useState([]);

  useEffect(() => {
    setData(data.map(item => ({
      ...item,
      timestamp: moment(item.timestamp).format(FORMAT)
    })))
  }, [data])

  return (
    <div className="lineChartBox border">
      {titleNode}
      <Loading visible={loading} style={{ display: 'block' }}>
      <Chart
        padding="auto"
        autoFit
        height={230}
        placeholder={<div className="chartPlaceholder">暂无数据</div>}
        data={dv}
      >
        <Axis
          name="timestamp"
          label={{ formatter: () => '' }}
          tickLine={null}
        />
        <Legend />
        <Geom
          type="line"
          position="timestamp*Value"
          shape="smooth"
          tooltip={['timestamp*Value', (timestamp, Value)=>{
            return {
              title: timestamp,
              name: 'Value',
              value: Value
            }
          }]}
        />
      </Chart>
      </Loading>
    </div>
  );
}