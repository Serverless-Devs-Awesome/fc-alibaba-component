import React, { useEffect, useState } from 'react';
import { Chart, Legend, Axis, Geom } from 'bizcharts';
import DataSet from "@antv/data-set";
import { Loading } from '@alicloud/console-components';
import _ from 'lodash';

import { FORMAT } from '../../../constants';
const moment = require('moment');

export default ({ data, loading, titleNode }) => {
  const [dv, setData] = useState([]);

  useEffect(() => {
    const { FunctionQualifierDestinationErrors, FunctionQualifierDestinationSuccessed } = data;
    const d = _.merge(FunctionQualifierDestinationErrors, FunctionQualifierDestinationSuccessed);
    const ds = new DataSet();
    const dv1 = ds.createView().source(d);
    dv1.transform({
      type: "pick",
      fields: ['destinationErrors', 'destinationSucceeded', 'timestamp']
    })
      .transform({
        type: 'map',
        callback(row) {
          return {
            timestamp: moment(row.timestamp).format(FORMAT),
            '成功次数': row.destinationSucceeded,
            '失败次数': row.destinationErrors
          };
        }
      })
      .transform({
        type: 'fold',
        fields: ['成功次数', '失败次数'],
        retains: ['timestamp']
      })
    setData(dv1)
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
        data={dv.rows}
      >
        <Axis
          name="timestamp"
          label={{ formatter: () => '' }}
          tickLine={null}
        />
        <Legend />
        <Geom
          type="line-advance"
          position="timestamp*value"
          shape="smooth"
          color="key"
          tooltip={['timestamp*value*key', (timestamp, value, key)=>{
            return {
              title: timestamp,
              name: key,
              value
            }
          }]}
        />
      </Chart>
      </Loading>
    </div>
  );
}