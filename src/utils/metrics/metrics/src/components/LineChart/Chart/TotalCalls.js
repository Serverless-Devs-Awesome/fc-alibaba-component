import React, { useEffect, useState } from 'react';
import {
  Chart,
  Axis,
  LineAdvance
} from 'bizcharts';
import DataSet from "@antv/data-set";
import { Loading } from '@alicloud/console-components';
import { LEGENDNAMELIST, FORMAT } from '../../../constants';
import { handlerData } from '../../../utils/handlerChartData';
const moment = require('moment');

export default ({
  FunctionClientErrors,
  FunctionServerErrors,
  FunctionTotalInvocations,
  loading,
  conf
}) => {
  const [dv, setData] = useState([]);

  useEffect(() => {
    const data = handlerData(
      [FunctionTotalInvocations, FunctionServerErrors, FunctionClientErrors],
      LEGENDNAMELIST,
      conf,
    );

    const ds = new DataSet();
    const d = ds.createView().source(data);
    d.transform({
      type: "pick",
      fields: [...LEGENDNAMELIST, 'timestamp']
    })
      .transform({
        type: 'sort-by',
        fields: ['timestamp'],
        order: 'ASC'
      })
      .transform({
        type: 'map',
        callback(row) {
          row.timestamp = `${moment(row.timestamp).format(FORMAT)} - 粒度: ${conf.period} 秒`;
          return row;
        }
      })
      .transform({
        type: 'fold',
        fields: [...LEGENDNAMELIST],
        retains: ['timestamp']
      })
    setData(d);
  }, [FunctionTotalInvocations, FunctionServerErrors, FunctionClientErrors, conf]);


  const showColors = (k) => {
    if (k === '客户端错误') {
      return '#F8DE8E'
    }
    if (k === '服务端错误') {
      return '#F5B59C'
    }
    return '#82A9DC'
  };

  return (
    <div className="totalBox border">
      <div className="chartTitle">总调用次数</div>
      <Loading visible={loading} style={{ display: 'block' }}>
      <Chart
        padding="auto"
        autoFit
        loading={loading}
        height={235}
        placeholder={<div className="chartPlaceholder">暂无数据</div>}
        data={dv.rows}
      >
        <Axis name="timestamp" label={{ formatter: () => '' }} tickLine={null} />
        <LineAdvance
          shape="smooth"
          position="timestamp*value"
          color={["key", showColors]}
          marker="square"
          area
        />
      </Chart>
      </Loading>
    </div>
  )
}